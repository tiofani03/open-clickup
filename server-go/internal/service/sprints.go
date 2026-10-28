package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"open-clickup-server/internal/db"
)

var (
	ErrSprintNotFound  = errors.New("sprint not found")
	ErrSprintConflict  = errors.New("sprint state conflict")
	ErrSprintForbidden = errors.New("resource is outside the sprint workspace")
	ErrSprintInvalid   = errors.New("invalid sprint input")
)

type SprintService struct {
	pool *pgxpool.Pool
}

func NewSprintService(pool *pgxpool.Pool) *SprintService {
	return &SprintService{pool: pool}
}

type SprintFolderInput struct {
	SpaceID          string
	Name             string
	DurationDays     int32
	StartDayOfWeek   int32
	StartTime        string
	Timezone         string
	EstimationMetric db.SprintEstimationMetric
	PointScale       []int32
	SourceListIDs    []string
}

type SprintInput struct {
	FolderID string
	Name     string
	Goal     *string
	StartsAt time.Time
	EndsAt   time.Time
	UserID   string
}

type UpdateSprintInput struct {
	SprintID string
	Name     *string
	Goal     *string
	SetGoal  bool
	StartsAt *time.Time
	EndsAt   *time.Time
}

type AddSprintTasksInput struct {
	SprintID        string
	TaskIDs         []string
	UserID          string
	ReplaceExisting bool
}

type CompletionChoice struct {
	TaskID         string
	Action         string
	TargetSprintID string
}

type CompleteSprintInput struct {
	SprintID       string
	UserID         string
	DefaultAction  string
	TargetSprintID string
	Overrides      []CompletionChoice
}

type CompleteSprintStats struct {
	Sprint      db.Sprint
	Completed   int
	CarriedOver int
	Unfinished  int
}

func normalizeFolderInput(in *SprintFolderInput) error {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" || in.SpaceID == "" {
		return fmt.Errorf("%w: name and spaceId are required", ErrSprintInvalid)
	}
	if in.DurationDays == 0 {
		in.DurationDays = 14
	}
	if in.DurationDays < 1 || in.DurationDays > 90 || in.StartDayOfWeek < 0 || in.StartDayOfWeek > 6 {
		return fmt.Errorf("%w: invalid duration or start day", ErrSprintInvalid)
	}
	if in.StartTime == "" {
		in.StartTime = "09:00"
	}
	if _, err := time.Parse("15:04", in.StartTime); err != nil {
		return fmt.Errorf("%w: startTime must use HH:mm", ErrSprintInvalid)
	}
	if in.Timezone == "" {
		in.Timezone = "UTC"
	}
	if _, err := time.LoadLocation(in.Timezone); err != nil {
		return fmt.Errorf("%w: unknown timezone", ErrSprintInvalid)
	}
	if in.EstimationMetric == "" {
		in.EstimationMetric = db.SprintEstimationMetricPOINTS
	}
	if in.EstimationMetric != db.SprintEstimationMetricPOINTS && in.EstimationMetric != db.SprintEstimationMetricTIME {
		return fmt.Errorf("%w: invalid estimation metric", ErrSprintInvalid)
	}
	if len(in.PointScale) == 0 {
		in.PointScale = []int32{1, 2, 3, 5, 8, 13}
	}
	seen := make(map[int32]bool, len(in.PointScale))
	for _, point := range in.PointScale {
		if point < 0 || seen[point] {
			return fmt.Errorf("%w: pointScale must contain unique non-negative values", ErrSprintInvalid)
		}
		seen[point] = true
	}
	sort.Slice(in.PointScale, func(i, j int) bool { return in.PointScale[i] < in.PointScale[j] })
	return nil
}

func (s *SprintService) CreateSprintFolder(ctx context.Context, in SprintFolderInput) (string, error) {
	if err := normalizeFolderInput(&in); err != nil {
		return "", err
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var workspaceID string
	if err := tx.QueryRow(ctx, `SELECT "workspaceId" FROM "Space" WHERE id = $1`, in.SpaceID).Scan(&workspaceID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", fmt.Errorf("%w: space not found", ErrSprintInvalid)
		}
		return "", err
	}
	if err := validateSourceLists(ctx, tx, workspaceID, in.SourceListIDs); err != nil {
		return "", err
	}

	var lastPosition float64
	_ = tx.QueryRow(ctx, `SELECT COALESCE(MAX(position), 0) FROM "Folder" WHERE "spaceId" = $1`, in.SpaceID).Scan(&lastPosition)
	folderID := cuid()
	if _, err := tx.Exec(ctx, `
		INSERT INTO "Folder" (id, "spaceId", name, kind, position, collapsed)
		VALUES ($1, $2, $3, 'SPRINT', $4, false)
	`, folderID, in.SpaceID, in.Name, lastPosition+1000); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO "SprintFolderSettings" (
			"folderId", "durationDays", "startDayOfWeek", "startTime", timezone,
			"estimationMetric", "pointScale"
		) VALUES ($1, $2, $3, $4::time, $5, $6, $7)
	`, folderID, in.DurationDays, in.StartDayOfWeek, in.StartTime, in.Timezone, in.EstimationMetric, in.PointScale); err != nil {
		return "", err
	}
	for index, listID := range uniqueStrings(in.SourceListIDs) {
		if _, err := tx.Exec(ctx, `
			INSERT INTO "SprintFolderSourceList" ("sprintFolderId", "listId", position)
			VALUES ($1, $2, $3)
		`, folderID, listID, float64(index*1000)); err != nil {
			return "", err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return folderID, nil
}

func (s *SprintService) UpdateSprintFolder(ctx context.Context, folderID string, in SprintFolderInput) error {
	if err := normalizeFolderInput(&in); err != nil {
		return err
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var workspaceID string
	err = tx.QueryRow(ctx, `
		SELECT sp."workspaceId"
		FROM "Folder" f JOIN "Space" sp ON sp.id = f."spaceId"
		WHERE f.id = $1 AND f.kind = 'SPRINT'
		FOR UPDATE OF f
	`, folderID).Scan(&workspaceID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrSprintNotFound
	}
	if err != nil {
		return err
	}
	if err := validateSourceLists(ctx, tx, workspaceID, in.SourceListIDs); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE "Folder" SET name = $2 WHERE id = $1`, folderID, in.Name); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE "SprintFolderSettings"
		SET "durationDays" = $2, "startDayOfWeek" = $3, "startTime" = $4::time,
			timezone = $5, "estimationMetric" = $6, "pointScale" = $7, "updatedAt" = NOW()
		WHERE "folderId" = $1
	`, folderID, in.DurationDays, in.StartDayOfWeek, in.StartTime, in.Timezone, in.EstimationMetric, in.PointScale); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM "SprintFolderSourceList" WHERE "sprintFolderId" = $1`, folderID); err != nil {
		return err
	}
	for index, listID := range uniqueStrings(in.SourceListIDs) {
		if _, err := tx.Exec(ctx, `
			INSERT INTO "SprintFolderSourceList" ("sprintFolderId", "listId", position)
			VALUES ($1, $2, $3)
		`, folderID, listID, float64(index*1000)); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *SprintService) DeleteSprintFolder(ctx context.Context, folderID string) error {
	var historical int
	if err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM "Sprint"
		WHERE "sprintFolderId" = $1 AND status <> 'PLANNED'
	`, folderID).Scan(&historical); err != nil {
		return err
	}
	if historical > 0 {
		return fmt.Errorf("%w: folders with started sprints cannot be deleted", ErrSprintConflict)
	}
	result, err := s.pool.Exec(ctx, `DELETE FROM "Folder" WHERE id = $1 AND kind = 'SPRINT'`, folderID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrSprintNotFound
	}
	return nil
}

func (s *SprintService) CreateSprint(ctx context.Context, in SprintInput) (db.Sprint, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" || in.FolderID == "" || !in.StartsAt.Before(in.EndsAt) {
		return db.Sprint{}, fmt.Errorf("%w: invalid sprint name or dates", ErrSprintInvalid)
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return db.Sprint{}, err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	settings, err := q.GetSprintFolderSettings(ctx, in.FolderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Sprint{}, ErrSprintNotFound
	}
	if err != nil {
		return db.Sprint{}, err
	}
	sprint, err := q.CreateSprint(ctx, db.CreateSprintParams{
		ID:               cuid(),
		SprintFolderId:   in.FolderID,
		Name:             in.Name,
		Goal:             nullableText(in.Goal),
		StartsAt:         pgtype.Timestamptz{Time: in.StartsAt, Valid: true},
		EndsAt:           pgtype.Timestamptz{Time: in.EndsAt, Valid: true},
		TimezoneSnapshot: settings.Timezone,
		CreatedById:      pgtype.Text{String: in.UserID, Valid: in.UserID != ""},
	})
	if err != nil {
		if isUniqueViolation(err) {
			return db.Sprint{}, fmt.Errorf("%w: sprint name already exists", ErrSprintConflict)
		}
		return db.Sprint{}, err
	}
	if err := createEvent(ctx, q, sprint.ID, "", in.UserID, db.SprintEventTypeSPRINTCREATED, nil, ""); err != nil {
		return db.Sprint{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return db.Sprint{}, err
	}
	return sprint, nil
}

func (s *SprintService) UpdateSprint(ctx context.Context, in UpdateSprintInput) (db.Sprint, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return db.Sprint{}, err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	existing, err := q.LockSprintByID(ctx, in.SprintID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Sprint{}, ErrSprintNotFound
	}
	if err != nil {
		return db.Sprint{}, err
	}
	if existing.Status != db.SprintStatusPLANNED {
		return db.Sprint{}, fmt.Errorf("%w: only planned sprints can be edited", ErrSprintConflict)
	}
	name := pgtype.Text{}
	if in.Name != nil {
		trimmed := strings.TrimSpace(*in.Name)
		if trimmed == "" {
			return db.Sprint{}, fmt.Errorf("%w: sprint name cannot be empty", ErrSprintInvalid)
		}
		name = pgtype.Text{String: trimmed, Valid: true}
	}
	startsAt := existing.StartsAt.Time
	if in.StartsAt != nil {
		startsAt = *in.StartsAt
	}
	endsAt := existing.EndsAt.Time
	if in.EndsAt != nil {
		endsAt = *in.EndsAt
	}
	if !startsAt.Before(endsAt) {
		return db.Sprint{}, fmt.Errorf("%w: startsAt must be before endsAt", ErrSprintInvalid)
	}
	updated, err := q.UpdateSprint(ctx, db.UpdateSprintParams{
		ID:       in.SprintID,
		Name:     name,
		SetGoal:  in.SetGoal,
		Goal:     nullableText(in.Goal),
		StartsAt: nullableTimestamptz(in.StartsAt),
		EndsAt:   nullableTimestamptz(in.EndsAt),
	})
	if err != nil {
		if isUniqueViolation(err) {
			return db.Sprint{}, fmt.Errorf("%w: sprint name already exists", ErrSprintConflict)
		}
		return db.Sprint{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return db.Sprint{}, err
	}
	return updated, nil
}

func (s *SprintService) DeleteSprint(ctx context.Context, sprintID string) error {
	rows, err := db.New(s.pool).DeletePlannedSprint(ctx, sprintID)
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("%w: only planned sprints can be deleted", ErrSprintConflict)
	}
	return nil
}

func (s *SprintService) AddTasks(ctx context.Context, in AddSprintTasksInput) error {
	if in.SprintID == "" || len(in.TaskIDs) == 0 {
		return fmt.Errorf("%w: sprintId and taskIds are required", ErrSprintInvalid)
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	sprint, err := q.LockSprintByID(ctx, in.SprintID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrSprintNotFound
	}
	if err != nil {
		return err
	}
	if sprint.Status != db.SprintStatusPLANNED && sprint.Status != db.SprintStatusACTIVE {
		return fmt.Errorf("%w: tasks can only be added to planned or active sprints", ErrSprintConflict)
	}

	var lastPosition float64
	_ = tx.QueryRow(ctx, `SELECT COALESCE(MAX(position), 0) FROM "SprintTask" WHERE "sprintId" = $1`, in.SprintID).Scan(&lastPosition)
	for _, taskID := range uniqueStrings(in.TaskIDs) {
		task, err := q.GetTaskByID(ctx, taskID)
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: task %s not found", ErrSprintInvalid, taskID)
		}
		if err != nil {
			return err
		}
		if task.Archived {
			return fmt.Errorf("%w: archived tasks cannot be added", ErrSprintInvalid)
		}
		var taskWorkspaceID string
		if err := tx.QueryRow(ctx, `
			SELECT sp."workspaceId" FROM "List" l JOIN "Space" sp ON sp.id = l."spaceId" WHERE l.id = $1
		`, task.ListId).Scan(&taskWorkspaceID); err != nil {
			return err
		}
		if taskWorkspaceID != sprint.WorkspaceId {
			return ErrSprintForbidden
		}
		var isSourceList bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM "SprintFolderSourceList"
				WHERE "sprintFolderId" = $1 AND "listId" = $2
			)
		`, sprint.SprintFolderId, task.ListId).Scan(&isSourceList); err != nil {
			return err
		}
		if !isSourceList {
			return fmt.Errorf("%w: task %s is not in a configured source List", ErrSprintInvalid, task.Name)
		}
		existing, existingErr := q.GetOpenSprintTaskByFolderTask(ctx, db.GetOpenSprintTaskByFolderTaskParams{
			SprintFolderId: sprint.SprintFolderId,
			TaskId:         pgtype.Text{String: taskID, Valid: true},
		})
		if existingErr == nil {
			if existing.SprintId == in.SprintID {
				continue
			}
			if !in.ReplaceExisting {
				return fmt.Errorf("%w: task %s is already in %s", ErrSprintConflict, task.Name, existing.SprintName)
			}
			if _, err := q.RemoveSprintTask(ctx, db.RemoveSprintTaskParams{
				SprintId: existing.SprintId, TaskId: pgtype.Text{String: taskID, Valid: true},
				RemovedById: pgtype.Text{String: in.UserID, Valid: in.UserID != ""},
			}); err != nil {
				return err
			}
			if err := createEvent(ctx, q, existing.SprintId, taskID, in.UserID, db.SprintEventTypeTASKREMOVED, map[string]any{"reason": "moved"}, task.Name); err != nil {
				return err
			}
		} else if !errors.Is(existingErr, pgx.ErrNoRows) {
			return existingErr
		}
		lastPosition += 1000
		if _, err := q.CreateSprintTask(ctx, db.CreateSprintTaskParams{
			ID:                   cuid(),
			SprintId:             in.SprintID,
			SprintFolderId:       sprint.SprintFolderId,
			TaskId:               pgtype.Text{String: taskID, Valid: true},
			Position:             lastPosition,
			AddedById:            pgtype.Text{String: in.UserID, Valid: in.UserID != ""},
			PointsAtAdd:          task.SprintPoints,
			TaskNameSnapshot:     task.Name,
			HomeListIdSnapshot:   task.ListId,
			HomeListNameSnapshot: task.ListName,
		}); err != nil {
			if isUniqueViolation(err) {
				return fmt.Errorf("%w: task already belongs to an open sprint", ErrSprintConflict)
			}
			return err
		}
		if err := createEvent(ctx, q, in.SprintID, taskID, in.UserID, db.SprintEventTypeTASKADDED, map[string]any{"afterStart": sprint.Status == db.SprintStatusACTIVE}, task.Name); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *SprintService) RemoveTask(ctx context.Context, sprintID, taskID, userID string) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	sprint, err := q.LockSprintByID(ctx, sprintID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrSprintNotFound
	}
	if err != nil {
		return err
	}
	if sprint.Status != db.SprintStatusPLANNED && sprint.Status != db.SprintStatusACTIVE {
		return ErrSprintConflict
	}
	task, err := q.GetTaskByID(ctx, taskID)
	if err != nil {
		return ErrSprintNotFound
	}
	rows, err := q.RemoveSprintTask(ctx, db.RemoveSprintTaskParams{
		SprintId: sprintID, TaskId: pgtype.Text{String: taskID, Valid: true},
		RemovedById: pgtype.Text{String: userID, Valid: userID != ""},
	})
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrSprintNotFound
	}
	if err := createEvent(ctx, q, sprintID, taskID, userID, db.SprintEventTypeTASKREMOVED, map[string]any{"afterStart": sprint.Status == db.SprintStatusACTIVE}, task.Name); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *SprintService) StartSprint(ctx context.Context, sprintID, userID string) (db.Sprint, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return db.Sprint{}, err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	sprint, err := q.LockSprintByID(ctx, sprintID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Sprint{}, ErrSprintNotFound
	}
	if err != nil {
		return db.Sprint{}, err
	}
	if sprint.Status != db.SprintStatusPLANNED {
		return db.Sprint{}, fmt.Errorf("%w: only planned sprints can be started", ErrSprintConflict)
	}
	if err := q.LockSprintForecast(ctx, sprintID); err != nil {
		return db.Sprint{}, err
	}
	started, err := q.StartSprint(ctx, sprintID)
	if err != nil {
		if isUniqueViolation(err) {
			return db.Sprint{}, fmt.Errorf("%w: another sprint is already active", ErrSprintConflict)
		}
		return db.Sprint{}, err
	}
	if err := createEvent(ctx, q, sprintID, "", userID, db.SprintEventTypeFORECASTLOCKED, nil, ""); err != nil {
		return db.Sprint{}, err
	}
	if err := createEvent(ctx, q, sprintID, "", userID, db.SprintEventTypeSPRINTSTARTED, nil, ""); err != nil {
		return db.Sprint{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return db.Sprint{}, err
	}
	return started, nil
}

func (s *SprintService) CompleteSprint(ctx context.Context, in CompleteSprintInput) (CompleteSprintStats, error) {
	if in.DefaultAction == "" {
		in.DefaultAction = "NO_SPRINT"
	}
	if in.DefaultAction != "CARRY_OVER" && in.DefaultAction != "NO_SPRINT" {
		return CompleteSprintStats{}, fmt.Errorf("%w: invalid completion action", ErrSprintInvalid)
	}
	overrides := make(map[string]CompletionChoice, len(in.Overrides))
	for _, choice := range in.Overrides {
		if choice.Action != "CARRY_OVER" && choice.Action != "NO_SPRINT" {
			return CompleteSprintStats{}, fmt.Errorf("%w: invalid override action", ErrSprintInvalid)
		}
		overrides[choice.TaskID] = choice
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return CompleteSprintStats{}, err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	sprint, err := q.LockSprintByID(ctx, in.SprintID)
	if errors.Is(err, pgx.ErrNoRows) {
		return CompleteSprintStats{}, ErrSprintNotFound
	}
	if err != nil {
		return CompleteSprintStats{}, err
	}
	if sprint.Status != db.SprintStatusACTIVE {
		return CompleteSprintStats{}, fmt.Errorf("%w: only active sprints can be completed", ErrSprintConflict)
	}
	memberships, err := q.ListSprintTaskMembershipsForUpdate(ctx, in.SprintID)
	if err != nil {
		return CompleteSprintStats{}, err
	}
	targetCache := map[string]db.LockSprintByIDRow{}
	loadTarget := func(targetID string) (db.LockSprintByIDRow, error) {
		if target, ok := targetCache[targetID]; ok {
			return target, nil
		}
		if targetID == "" || targetID == in.SprintID {
			return db.LockSprintByIDRow{}, fmt.Errorf("%w: target sprint is required", ErrSprintInvalid)
		}
		target, err := q.LockSprintByID(ctx, targetID)
		if err != nil {
			return db.LockSprintByIDRow{}, fmt.Errorf("%w: target sprint not found", ErrSprintInvalid)
		}
		if target.SprintFolderId != sprint.SprintFolderId || target.Status != db.SprintStatusPLANNED {
			return db.LockSprintByIDRow{}, fmt.Errorf("%w: carry-over target must be a planned sprint in the same folder", ErrSprintInvalid)
		}
		targetCache[targetID] = target
		return target, nil
	}

	stats := CompleteSprintStats{}
	for _, membership := range memberships {
		taskID := membership.TaskId.String
		outcome := db.SprintTaskOutcomeUNFINISHED
		var carryTarget *db.LockSprintByIDRow
		if membership.StatusType == db.StatusTypeDONE || membership.StatusType == db.StatusTypeCLOSED {
			outcome = db.SprintTaskOutcomeCOMPLETED
			stats.Completed++
		} else {
			choice := CompletionChoice{TaskID: taskID, Action: in.DefaultAction, TargetSprintID: in.TargetSprintID}
			if override, ok := overrides[taskID]; ok {
				choice = override
			}
			if choice.Action == "CARRY_OVER" {
				target, err := loadTarget(choice.TargetSprintID)
				if err != nil {
					return CompleteSprintStats{}, err
				}
				outcome = db.SprintTaskOutcomeCARRIEDOVER
				carryTarget = &target
				stats.CarriedOver++
			} else {
				stats.Unfinished++
			}
		}
		if err := q.SetSprintTaskOutcome(ctx, db.SetSprintTaskOutcomeParams{
			ID:                   membership.ID,
			Outcome:              db.NullSprintTaskOutcome{SprintTaskOutcome: outcome, Valid: true},
			PointsAtClose:        membership.SprintPoints,
			TimeEstimateAtClose:  membership.TimeEstimate,
			TaskNameSnapshot:     membership.TaskName,
			HomeListIdSnapshot:   membership.ListId,
			HomeListNameSnapshot: membership.ListName,
		}); err != nil {
			return CompleteSprintStats{}, err
		}
		// Close the source membership before creating the target membership. The
		// database deliberately permits only one open Sprint membership per task
		// in a Sprint Folder, so doing this in the opposite order violates that
		// invariant during carry-over.
		if carryTarget != nil {
			if err := createCarriedMembership(ctx, tx, q, *carryTarget, membership, in.UserID); err != nil {
				return CompleteSprintStats{}, err
			}
		}
		if outcome == db.SprintTaskOutcomeCOMPLETED {
			if err := createEvent(ctx, q, in.SprintID, taskID, in.UserID, db.SprintEventTypeTASKCOMPLETED, nil, membership.TaskName); err != nil {
				return CompleteSprintStats{}, err
			}
		}
	}
	completed, err := q.CompleteSprint(ctx, in.SprintID)
	if err != nil {
		return CompleteSprintStats{}, err
	}
	if err := createEvent(ctx, q, in.SprintID, "", in.UserID, db.SprintEventTypeSPRINTCOMPLETED, map[string]any{
		"completed": stats.Completed, "carriedOver": stats.CarriedOver, "unfinished": stats.Unfinished,
	}, ""); err != nil {
		return CompleteSprintStats{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return CompleteSprintStats{}, err
	}
	stats.Sprint = completed
	return stats, nil
}

func (s *SprintService) CancelSprint(ctx context.Context, sprintID, userID string) (db.Sprint, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return db.Sprint{}, err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	sprint, err := q.LockSprintByID(ctx, sprintID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Sprint{}, ErrSprintNotFound
	}
	if err != nil {
		return db.Sprint{}, err
	}
	if sprint.Status != db.SprintStatusPLANNED && sprint.Status != db.SprintStatusACTIVE {
		return db.Sprint{}, ErrSprintConflict
	}
	if _, err := tx.Exec(ctx, `
		UPDATE "SprintTask" st
		SET outcome = 'CANCELLED', "pointsAtClose" = t."sprintPoints", "timeEstimateAtClose" = t."timeEstimate"
		FROM "Task" t
		WHERE st."sprintId" = $1 AND st."taskId" = t.id AND st.outcome IS NULL AND st."removedAt" IS NULL
	`, sprintID); err != nil {
		return db.Sprint{}, err
	}
	cancelled, err := q.CancelSprint(ctx, sprintID)
	if err != nil {
		return db.Sprint{}, err
	}
	if err := createEvent(ctx, q, sprintID, "", userID, db.SprintEventTypeSPRINTCANCELLED, nil, ""); err != nil {
		return db.Sprint{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return db.Sprint{}, err
	}
	return cancelled, nil
}

func validateSourceLists(ctx context.Context, tx pgx.Tx, workspaceID string, listIDs []string) error {
	for _, listID := range uniqueStrings(listIDs) {
		var listWorkspaceID string
		if err := tx.QueryRow(ctx, `
			SELECT sp."workspaceId" FROM "List" l JOIN "Space" sp ON sp.id = l."spaceId" WHERE l.id = $1
		`, listID).Scan(&listWorkspaceID); err != nil {
			return fmt.Errorf("%w: source list not found", ErrSprintInvalid)
		}
		if listWorkspaceID != workspaceID {
			return ErrSprintForbidden
		}
	}
	return nil
}

func createCarriedMembership(
	ctx context.Context,
	tx pgx.Tx,
	q *db.Queries,
	target db.LockSprintByIDRow,
	source db.ListSprintTaskMembershipsForUpdateRow,
	userID string,
) error {
	var lastPosition float64
	_ = tx.QueryRow(ctx, `SELECT COALESCE(MAX(position), 0) FROM "SprintTask" WHERE "sprintId" = $1`, target.ID).Scan(&lastPosition)
	_, err := q.CreateSprintTask(ctx, db.CreateSprintTaskParams{
		ID:                      cuid(),
		SprintId:                target.ID,
		SprintFolderId:          target.SprintFolderId,
		TaskId:                  source.TaskId,
		Position:                lastPosition + 1000,
		AddedById:               pgtype.Text{String: userID, Valid: userID != ""},
		CarriedFromMembershipId: pgtype.Text{String: source.ID, Valid: true},
		PointsAtAdd:             source.SprintPoints,
		TaskNameSnapshot:        source.TaskName,
		HomeListIdSnapshot:      source.ListId,
		HomeListNameSnapshot:    source.ListName,
	})
	if err != nil {
		return err
	}
	return createEvent(ctx, q, target.ID, source.TaskId.String, userID, db.SprintEventTypeTASKCARRIEDOVER, map[string]any{
		"fromSprintId": source.SprintId,
	}, source.TaskName)
}

func createEvent(ctx context.Context, q *db.Queries, sprintID, taskID, actorID string, eventType db.SprintEventType, data any, taskName string) error {
	payload := []byte(`{}`)
	if data != nil {
		var err error
		payload, err = json.Marshal(data)
		if err != nil {
			return err
		}
	}
	_, err := q.CreateSprintEvent(ctx, db.CreateSprintEventParams{
		ID:               cuid(),
		SprintId:         sprintID,
		TaskId:           pgtype.Text{String: taskID, Valid: taskID != ""},
		ActorId:          pgtype.Text{String: actorID, Valid: actorID != ""},
		Type:             eventType,
		Data:             payload,
		TaskNameSnapshot: pgtype.Text{String: taskName, Valid: taskName != ""},
	})
	return err
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]bool, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	return result
}

func nullableText(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: strings.TrimSpace(*value), Valid: true}
}

func nullableTimestamptz(value *time.Time) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *value, Valid: true}
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
