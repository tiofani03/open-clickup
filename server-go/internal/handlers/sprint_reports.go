package handlers

import (
	"math"
	"time"

	"github.com/gofiber/fiber/v2"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/service"
)

type sprintReportMembership struct {
	addedAt     time.Time
	removedAt   *time.Time
	points      int
	completedAt *time.Time
	outcome     *string
	name        string
	listName    string
}

// GetSprintReport returns immutable Sprint snapshots and a daily chart series.
// It intentionally uses SprintTask snapshots rather than current task values so
// completed Sprint reports remain stable after tasks are edited or deleted.
func (h *SprintsHandler) GetSprintReport(c *fiber.Ctx) error {
	sprintID := c.Params("sprintId")
	if !h.requireSprintRole(c, sprintID, db.MemberRoleGUEST) {
		return nil
	}
	sprint, err := h.q.GetSprintByID(c.Context(), sprintID)
	if err != nil {
		return sprintError(c, service.ErrSprintNotFound)
	}
	rows, err := h.pool.Query(c.Context(), `
		SELECT st."addedAt", st."removedAt",
		       COALESCE(st."forecastPoints", st."pointsAtClose", st."pointsAtAdd", t."sprintPoints", 0)::int,
		       t."completedAt", st.outcome::text, st."taskNameSnapshot", st."homeListNameSnapshot"
		FROM "SprintTask" st
		LEFT JOIN "Task" t ON t.id = st."taskId"
		WHERE st."sprintId" = $1
		ORDER BY st."addedAt"
	`, sprintID)
	if err != nil {
		return sprintError(c, err)
	}
	defer rows.Close()
	memberships := []sprintReportMembership{}
	for rows.Next() {
		var item sprintReportMembership
		if err := rows.Scan(&item.addedAt, &item.removedAt, &item.points, &item.completedAt, &item.outcome, &item.name, &item.listName); err != nil {
			return sprintError(c, err)
		}
		memberships = append(memberships, item)
	}

	location, err := time.LoadLocation(sprint.TimezoneSnapshot)
	if err != nil {
		location = time.UTC
	}
	start := dayStart(sprint.StartsAt.Time, location)
	effectiveStart := sprint.StartsAt.Time
	if sprint.StartedAt.Valid {
		effectiveStart = sprint.StartedAt.Time
	}
	end := dayStart(sprint.EndsAt.Time, location)
	if end.Before(start) {
		end = start
	}
	now := dayStart(time.Now(), location)
	actualUntil := now
	if sprint.CompletedAt.Valid && sprint.CompletedAt.Time.Before(actualUntil) {
		actualUntil = dayStart(sprint.CompletedAt.Time, location)
	}
	if actualUntil.After(end) {
		actualUntil = end
	}

	forecastPoints, forecastTasks := 0, 0
	for _, item := range memberships {
		if !item.addedAt.After(effectiveStart) && (item.removedAt == nil || item.removedAt.After(effectiveStart)) {
			forecastPoints += item.points
			forecastTasks++
		}
	}
	totalDays := int(end.Sub(start).Hours()/24) + 1
	series := make([]fiber.Map, 0, totalDays)
	for index := 0; index < totalDays; index++ {
		date := start.AddDate(0, 0, index)
		dayEnd := date.AddDate(0, 0, 1)
		scopePoints, completedPoints, scopeTasks, completedTasks := 0, 0, 0, 0
		for _, item := range memberships {
			if item.addedAt.Before(dayEnd) && (item.removedAt == nil || !item.removedAt.Before(dayEnd)) {
				scopePoints += item.points
				scopeTasks++
				completed := item.completedAt != nil && item.completedAt.Before(dayEnd)
				if sprint.Status == db.SprintStatusCOMPLETED && item.outcome != nil && *item.outcome == string(db.SprintTaskOutcomeCOMPLETED) && date.Equal(actualUntil) {
					completed = true
				}
				if completed {
					completedPoints += item.points
					completedTasks++
				}
			}
		}
		idealRemaining := float64(forecastPoints)
		if totalDays > 1 {
			idealRemaining = float64(forecastPoints) * (1 - float64(index)/float64(totalDays-1))
		}
		point := fiber.Map{
			"date": date.Format("2006-01-02"), "idealRemaining": math.Round(idealRemaining*100) / 100,
		}
		if !date.After(actualUntil) {
			point["scopePoints"] = scopePoints
			point["completedPoints"] = completedPoints
			point["remainingPoints"] = maxInt(scopePoints-completedPoints, 0)
			point["scopeTasks"] = scopeTasks
			point["completedTasks"] = completedTasks
		}
		series = append(series, point)
	}

	addedPoints, removedPoints, addedTasks, removedTasks := 0, 0, 0, 0
	changes := []fiber.Map{}
	for _, item := range memberships {
		if item.addedAt.After(effectiveStart) {
			addedPoints += item.points
			addedTasks++
			changes = append(changes, fiber.Map{"type": "ADDED", "at": formatTime(item.addedAt), "taskName": item.name, "listName": item.listName, "points": item.points})
		}
		if item.removedAt != nil && item.removedAt.After(effectiveStart) {
			removedPoints += item.points
			removedTasks++
			changes = append(changes, fiber.Map{"type": "REMOVED", "at": formatTime(*item.removedAt), "taskName": item.name, "listName": item.listName, "points": item.points})
		}
	}
	return c.JSON(fiber.Map{
		"forecast":    fiber.Map{"tasks": forecastTasks, "points": forecastPoints},
		"scopeChange": fiber.Map{"addedTasks": addedTasks, "addedPoints": addedPoints, "removedTasks": removedTasks, "removedPoints": removedPoints},
		"series":      series,
		"changes":     changes,
	})
}

// GetSprintFolderReport exposes historical velocity for completed Sprints.
func (h *SprintsHandler) GetSprintFolderReport(c *fiber.Ctx) error {
	folderID := c.Params("folderId")
	if !h.requireFolderRole(c, folderID, db.MemberRoleGUEST) {
		return nil
	}
	rows, err := h.pool.Query(c.Context(), `
		SELECT s.id, s.name, s."startsAt", s."endsAt", s."completedAt",
		       COUNT(st.id)::int,
		       COUNT(st.id) FILTER (WHERE st.outcome = 'COMPLETED')::int,
		       COUNT(st.id) FILTER (WHERE st.outcome = 'CARRIED_OVER')::int,
		       COALESCE(SUM(COALESCE(st."forecastPoints", st."pointsAtAdd", 0)), 0)::int,
		       COALESCE(SUM(COALESCE(st."pointsAtClose", st."forecastPoints", st."pointsAtAdd", 0)) FILTER (WHERE st.outcome = 'COMPLETED'), 0)::int
		FROM "Sprint" s
		LEFT JOIN "SprintTask" st ON st."sprintId" = s.id AND st."removedAt" IS NULL
		WHERE s."sprintFolderId" = $1 AND s.status = 'COMPLETED'
		GROUP BY s.id
		ORDER BY s."startsAt" ASC
	`, folderID)
	if err != nil {
		return sprintError(c, err)
	}
	defer rows.Close()
	items := []fiber.Map{}
	totalVelocity := 0
	for rows.Next() {
		var id, name string
		var startsAt, endsAt time.Time
		var completedAt *time.Time
		var committedTasks, completedTasks, carriedTasks, forecastPoints, completedPoints int
		if err := rows.Scan(&id, &name, &startsAt, &endsAt, &completedAt, &committedTasks, &completedTasks, &carriedTasks, &forecastPoints, &completedPoints); err != nil {
			return sprintError(c, err)
		}
		totalVelocity += completedPoints
		items = append(items, fiber.Map{"id": id, "name": name, "startsAt": formatTime(startsAt), "endsAt": formatTime(endsAt), "completedAt": completedAt, "committedTasks": committedTasks, "completedTasks": completedTasks, "carriedTasks": carriedTasks, "forecastPoints": forecastPoints, "completedPoints": completedPoints})
	}
	average := 0.0
	if len(items) > 0 {
		average = math.Round(float64(totalVelocity)/float64(len(items))*10) / 10
	}
	return c.JSON(fiber.Map{"sprints": items, "averageVelocity": average})
}

func dayStart(value time.Time, location *time.Location) time.Time {
	local := value.In(location)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
