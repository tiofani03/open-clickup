--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: CustomFieldType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CustomFieldType" AS ENUM (
    'TEXT',
    'TEXTAREA',
    'NUMBER',
    'MONEY',
    'DROPDOWN',
    'LABELS',
    'DATE',
    'CHECKBOX',
    'URL',
    'EMAIL',
    'PHONE',
    'RATING',
    'PROGRESS'
);


--
-- Name: MemberRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MemberRole" AS ENUM (
    'OWNER',
    'ADMIN',
    'MEMBER',
    'GUEST'
);


--
-- Name: Priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Priority" AS ENUM (
    'URGENT',
    'HIGH',
    'NORMAL',
    'LOW'
);


--
-- Name: StatusType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusType" AS ENUM (
    'NOT_STARTED',
    'ACTIVE',
    'DONE',
    'CLOSED'
);


--
-- Name: ViewType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ViewType" AS ENUM (
    'LIST',
    'BOARD',
    'CALENDAR',
    'GANTT',
    'TABLE'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Activity" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "userId" text,
    type text NOT NULL,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Attachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Attachment" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    size integer NOT NULL,
    mime text NOT NULL,
    "uploadedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Checklist" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    name text DEFAULT 'Checklist'::text NOT NULL,
    "position" double precision DEFAULT 0 NOT NULL
);


--
-- Name: ChecklistItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChecklistItem" (
    id text NOT NULL,
    "checklistId" text NOT NULL,
    name text NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    "position" double precision DEFAULT 0 NOT NULL
);


--
-- Name: Comment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "userId" text NOT NULL,
    body text NOT NULL,
    "parentId" text,
    resolved boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CommentReaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CommentReaction" (
    id text NOT NULL,
    "commentId" text NOT NULL,
    "userId" text NOT NULL,
    emoji text NOT NULL
);


--
-- Name: CustomField; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomField" (
    id text NOT NULL,
    "listId" text NOT NULL,
    name text NOT NULL,
    type public."CustomFieldType" NOT NULL,
    config jsonb,
    "position" double precision DEFAULT 0 NOT NULL
);


--
-- Name: CustomFieldOption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomFieldOption" (
    id text NOT NULL,
    "customFieldId" text NOT NULL,
    label text NOT NULL,
    color text DEFAULT '#656f7d'::text NOT NULL,
    "position" double precision DEFAULT 0 NOT NULL
);


--
-- Name: CustomFieldValue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomFieldValue" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "customFieldId" text NOT NULL,
    value jsonb NOT NULL
);


--
-- Name: Favorite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Favorite" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "listId" text NOT NULL
);


--
-- Name: Folder; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Folder" (
    id text NOT NULL,
    "spaceId" text NOT NULL,
    name text NOT NULL,
    "position" double precision DEFAULT 0 NOT NULL,
    collapsed boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: List; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."List" (
    id text NOT NULL,
    "spaceId" text NOT NULL,
    "folderId" text,
    name text NOT NULL,
    color text,
    icon text,
    "position" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "actorId" text,
    "taskId" text,
    type text NOT NULL,
    body text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Space; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Space" (
    id text NOT NULL,
    "workspaceId" text NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#7b68ee'::text NOT NULL,
    icon text,
    private boolean DEFAULT false NOT NULL,
    "position" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Status" (
    id text NOT NULL,
    "listId" text NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#87909e'::text NOT NULL,
    type public."StatusType" DEFAULT 'NOT_STARTED'::public."StatusType" NOT NULL,
    "position" double precision DEFAULT 0 NOT NULL,
    "wipLimit" integer
);


--
-- Name: Tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tag" (
    id text NOT NULL,
    "spaceId" text NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#656f7d'::text NOT NULL
);


--
-- Name: Task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    "listId" text NOT NULL,
    "statusId" text NOT NULL,
    "parentId" text,
    name text NOT NULL,
    description text,
    priority public."Priority",
    "position" double precision DEFAULT 0 NOT NULL,
    "startDate" timestamp(3) without time zone,
    "dueDate" timestamp(3) without time zone,
    "timeEstimate" integer,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "completedAt" timestamp(3) without time zone,
    archived boolean DEFAULT false NOT NULL,
    recurrence text
);


--
-- Name: TaskAssignee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TaskAssignee" (
    "taskId" text NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: TaskDependency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TaskDependency" (
    id text NOT NULL,
    "blockerId" text NOT NULL,
    "blockedId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TaskTag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TaskTag" (
    "taskId" text NOT NULL,
    "tagId" text NOT NULL
);


--
-- Name: TaskTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TaskTemplate" (
    id text NOT NULL,
    "workspaceId" text NOT NULL,
    name text NOT NULL,
    "taskName" text NOT NULL,
    description text,
    priority public."Priority",
    checklists jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TaskWatcher; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TaskWatcher" (
    "taskId" text NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: TimeEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TimeEntry" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "userId" text NOT NULL,
    duration integer DEFAULT 0 NOT NULL,
    description text,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#7b68ee'::text NOT NULL,
    "avatarUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "passwordHash" text
);


--
-- Name: View; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."View" (
    id text NOT NULL,
    "listId" text NOT NULL,
    name text NOT NULL,
    type public."ViewType" NOT NULL,
    config jsonb,
    "position" double precision DEFAULT 0 NOT NULL
);


--
-- Name: Workspace; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Workspace" (
    id text NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#7b68ee'::text NOT NULL,
    "avatarUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: WorkspaceMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkspaceMember" (
    id text NOT NULL,
    "workspaceId" text NOT NULL,
    "userId" text NOT NULL,
    role public."MemberRole" DEFAULT 'MEMBER'::public."MemberRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: Activity Activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_pkey" PRIMARY KEY (id);


--
-- Name: Attachment Attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_pkey" PRIMARY KEY (id);


--
-- Name: ChecklistItem ChecklistItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChecklistItem"
    ADD CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY (id);


--
-- Name: Checklist Checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Checklist"
    ADD CONSTRAINT "Checklist_pkey" PRIMARY KEY (id);


--
-- Name: CommentReaction CommentReaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CommentReaction"
    ADD CONSTRAINT "CommentReaction_pkey" PRIMARY KEY (id);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: CustomFieldOption CustomFieldOption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomFieldOption"
    ADD CONSTRAINT "CustomFieldOption_pkey" PRIMARY KEY (id);


--
-- Name: CustomFieldValue CustomFieldValue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomFieldValue"
    ADD CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY (id);


--
-- Name: CustomField CustomField_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomField"
    ADD CONSTRAINT "CustomField_pkey" PRIMARY KEY (id);


--
-- Name: Favorite Favorite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Favorite"
    ADD CONSTRAINT "Favorite_pkey" PRIMARY KEY (id);


--
-- Name: Folder Folder_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Folder"
    ADD CONSTRAINT "Folder_pkey" PRIMARY KEY (id);


--
-- Name: List List_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."List"
    ADD CONSTRAINT "List_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: Space Space_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Space"
    ADD CONSTRAINT "Space_pkey" PRIMARY KEY (id);


--
-- Name: Status Status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Status"
    ADD CONSTRAINT "Status_pkey" PRIMARY KEY (id);


--
-- Name: Tag Tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tag"
    ADD CONSTRAINT "Tag_pkey" PRIMARY KEY (id);


--
-- Name: TaskAssignee TaskAssignee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskAssignee"
    ADD CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId", "userId");


--
-- Name: TaskDependency TaskDependency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskDependency"
    ADD CONSTRAINT "TaskDependency_pkey" PRIMARY KEY (id);


--
-- Name: TaskTag TaskTag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskTag"
    ADD CONSTRAINT "TaskTag_pkey" PRIMARY KEY ("taskId", "tagId");


--
-- Name: TaskTemplate TaskTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskTemplate"
    ADD CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY (id);


--
-- Name: TaskWatcher TaskWatcher_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskWatcher"
    ADD CONSTRAINT "TaskWatcher_pkey" PRIMARY KEY ("taskId", "userId");


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: TimeEntry TimeEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: View View_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."View"
    ADD CONSTRAINT "View_pkey" PRIMARY KEY (id);


--
-- Name: WorkspaceMember WorkspaceMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkspaceMember"
    ADD CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY (id);


--
-- Name: Workspace Workspace_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Workspace"
    ADD CONSTRAINT "Workspace_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Activity_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Activity_taskId_idx" ON public."Activity" USING btree ("taskId");


--
-- Name: Attachment_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_taskId_idx" ON public."Attachment" USING btree ("taskId");


--
-- Name: ChecklistItem_checklistId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChecklistItem_checklistId_idx" ON public."ChecklistItem" USING btree ("checklistId");


--
-- Name: Checklist_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Checklist_taskId_idx" ON public."Checklist" USING btree ("taskId");


--
-- Name: CommentReaction_commentId_userId_emoji_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CommentReaction_commentId_userId_emoji_key" ON public."CommentReaction" USING btree ("commentId", "userId", emoji);


--
-- Name: Comment_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Comment_taskId_idx" ON public."Comment" USING btree ("taskId");


--
-- Name: CustomFieldOption_customFieldId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomFieldOption_customFieldId_idx" ON public."CustomFieldOption" USING btree ("customFieldId");


--
-- Name: CustomFieldValue_taskId_customFieldId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomFieldValue_taskId_customFieldId_key" ON public."CustomFieldValue" USING btree ("taskId", "customFieldId");


--
-- Name: CustomFieldValue_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomFieldValue_taskId_idx" ON public."CustomFieldValue" USING btree ("taskId");


--
-- Name: CustomField_listId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomField_listId_idx" ON public."CustomField" USING btree ("listId");


--
-- Name: Favorite_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Favorite_userId_idx" ON public."Favorite" USING btree ("userId");


--
-- Name: Favorite_userId_listId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Favorite_userId_listId_key" ON public."Favorite" USING btree ("userId", "listId");


--
-- Name: Folder_spaceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Folder_spaceId_idx" ON public."Folder" USING btree ("spaceId");


--
-- Name: List_folderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "List_folderId_idx" ON public."List" USING btree ("folderId");


--
-- Name: List_spaceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "List_spaceId_idx" ON public."List" USING btree ("spaceId");


--
-- Name: Notification_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_idx" ON public."Notification" USING btree ("userId");


--
-- Name: Session_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Session_userId_idx" ON public."Session" USING btree ("userId");


--
-- Name: Space_workspaceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Space_workspaceId_idx" ON public."Space" USING btree ("workspaceId");


--
-- Name: Status_listId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Status_listId_idx" ON public."Status" USING btree ("listId");


--
-- Name: Tag_spaceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tag_spaceId_idx" ON public."Tag" USING btree ("spaceId");


--
-- Name: Tag_spaceId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tag_spaceId_name_key" ON public."Tag" USING btree ("spaceId", name);


--
-- Name: TaskDependency_blockedId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskDependency_blockedId_idx" ON public."TaskDependency" USING btree ("blockedId");


--
-- Name: TaskDependency_blockerId_blockedId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TaskDependency_blockerId_blockedId_key" ON public."TaskDependency" USING btree ("blockerId", "blockedId");


--
-- Name: TaskDependency_blockerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskDependency_blockerId_idx" ON public."TaskDependency" USING btree ("blockerId");


--
-- Name: TaskTemplate_workspaceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskTemplate_workspaceId_idx" ON public."TaskTemplate" USING btree ("workspaceId");


--
-- Name: Task_listId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_listId_idx" ON public."Task" USING btree ("listId");


--
-- Name: Task_parentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_parentId_idx" ON public."Task" USING btree ("parentId");


--
-- Name: Task_statusId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_statusId_idx" ON public."Task" USING btree ("statusId");


--
-- Name: TimeEntry_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TimeEntry_taskId_idx" ON public."TimeEntry" USING btree ("taskId");


--
-- Name: TimeEntry_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TimeEntry_userId_idx" ON public."TimeEntry" USING btree ("userId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: View_listId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "View_listId_idx" ON public."View" USING btree ("listId");


--
-- Name: WorkspaceMember_workspaceId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON public."WorkspaceMember" USING btree ("workspaceId", "userId");


--
-- Name: Activity Activity_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Activity Activity_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Attachment Attachment_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChecklistItem ChecklistItem_checklistId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChecklistItem"
    ADD CONSTRAINT "ChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES public."Checklist"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Checklist Checklist_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Checklist"
    ADD CONSTRAINT "Checklist_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CommentReaction CommentReaction_commentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CommentReaction"
    ADD CONSTRAINT "CommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES public."Comment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CommentReaction CommentReaction_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CommentReaction"
    ADD CONSTRAINT "CommentReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Comment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CustomFieldOption CustomFieldOption_customFieldId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomFieldOption"
    ADD CONSTRAINT "CustomFieldOption_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES public."CustomField"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CustomFieldValue CustomFieldValue_customFieldId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomFieldValue"
    ADD CONSTRAINT "CustomFieldValue_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES public."CustomField"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CustomFieldValue CustomFieldValue_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomFieldValue"
    ADD CONSTRAINT "CustomFieldValue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CustomField CustomField_listId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomField"
    ADD CONSTRAINT "CustomField_listId_fkey" FOREIGN KEY ("listId") REFERENCES public."List"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Favorite Favorite_listId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Favorite"
    ADD CONSTRAINT "Favorite_listId_fkey" FOREIGN KEY ("listId") REFERENCES public."List"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Favorite Favorite_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Favorite"
    ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Folder Folder_spaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Folder"
    ADD CONSTRAINT "Folder_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES public."Space"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: List List_folderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."List"
    ADD CONSTRAINT "List_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES public."Folder"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: List List_spaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."List"
    ADD CONSTRAINT "List_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES public."Space"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_actorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Space Space_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Space"
    ADD CONSTRAINT "Space_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Status Status_listId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Status"
    ADD CONSTRAINT "Status_listId_fkey" FOREIGN KEY ("listId") REFERENCES public."List"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Tag Tag_spaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tag"
    ADD CONSTRAINT "Tag_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES public."Space"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskAssignee TaskAssignee_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskAssignee"
    ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskAssignee TaskAssignee_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskAssignee"
    ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskDependency TaskDependency_blockedId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskDependency"
    ADD CONSTRAINT "TaskDependency_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskDependency TaskDependency_blockerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskDependency"
    ADD CONSTRAINT "TaskDependency_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskTag TaskTag_tagId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskTag"
    ADD CONSTRAINT "TaskTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES public."Tag"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskTag TaskTag_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskTag"
    ADD CONSTRAINT "TaskTag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskTemplate TaskTemplate_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskTemplate"
    ADD CONSTRAINT "TaskTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskWatcher TaskWatcher_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskWatcher"
    ADD CONSTRAINT "TaskWatcher_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskWatcher TaskWatcher_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskWatcher"
    ADD CONSTRAINT "TaskWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_listId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_listId_fkey" FOREIGN KEY ("listId") REFERENCES public."List"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_statusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES public."Status"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TimeEntry TimeEntry_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TimeEntry TimeEntry_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: View View_listId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."View"
    ADD CONSTRAINT "View_listId_fkey" FOREIGN KEY ("listId") REFERENCES public."List"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkspaceMember WorkspaceMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkspaceMember"
    ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WorkspaceMember WorkspaceMember_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkspaceMember"
    ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

CREATE TABLE "Doc" (
    "id" TEXT PRIMARY KEY,
    "workspace_id" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
    "space_id" TEXT REFERENCES "Space"("id") ON DELETE CASCADE,
    "folder_id" TEXT REFERENCES "Folder"("id") ON DELETE SET NULL,
    "list_id" TEXT REFERENCES "List"("id") ON DELETE SET NULL,
    "task_id" TEXT REFERENCES "Task"("id") ON DELETE SET NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled Doc',
    "created_by_id" TEXT NOT NULL REFERENCES "User"("id"),
    "is_pinned" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_doc_workspace" ON "Doc"("workspace_id");
CREATE INDEX "idx_doc_space" ON "Doc"("space_id");
CREATE INDEX "idx_doc_list" ON "Doc"("list_id");
CREATE INDEX "idx_doc_task" ON "Doc"("task_id");

CREATE TABLE "DocPage" (
    "id" TEXT PRIMARY KEY,
    "doc_id" TEXT NOT NULL REFERENCES "Doc"("id") ON DELETE CASCADE,
    "parent_page_id" TEXT REFERENCES "DocPage"("id") ON DELETE CASCADE,
    "title" TEXT NOT NULL DEFAULT 'Untitled Page',
    "content_markdown" TEXT NOT NULL DEFAULT '',
    "content_html" TEXT NOT NULL DEFAULT '',
    "icon" TEXT,
    "cover_image" TEXT,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 65535.0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "has_draft" BOOLEAN NOT NULL DEFAULT false,
    "draft_markdown" TEXT,
    "draft_html" TEXT
);

CREATE INDEX "idx_doc_page_doc" ON "DocPage"("doc_id");
CREATE INDEX "idx_doc_page_parent" ON "DocPage"("parent_page_id");

CREATE TABLE "DocComment" (
    "id" TEXT PRIMARY KEY,
    "doc_page_id" TEXT NOT NULL REFERENCES "DocPage"("id") ON DELETE CASCADE,
    "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "body" TEXT NOT NULL,
    "parent_id" TEXT REFERENCES "DocComment"("id") ON DELETE CASCADE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_doc_comment_page" ON "DocComment"("doc_page_id");
CREATE INDEX "idx_doc_comment_parent" ON "DocComment"("parent_id");
