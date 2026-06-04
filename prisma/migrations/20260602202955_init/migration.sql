-- CreateTable
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "password" TEXT,
    "security_question" TEXT,
    "security_answer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_columns" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lab_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "student_id" INTEGER NOT NULL,
    "column_id" INTEGER NOT NULL,
    "value" DOUBLE PRECISION,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("student_id","column_id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "labs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "password" TEXT,
    "level" TEXT,
    "auto_approve" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructors" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT,
    "lab_id" INTEGER NOT NULL,
    "security_question" TEXT,
    "security_answer" TEXT,
    "reset_token" TEXT,
    "reset_token_expiry" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "show_grades" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_labs" (
    "student_id" INTEGER NOT NULL,
    "lab_id" INTEGER NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_labs_pkey" PRIMARY KEY ("student_id","lab_id")
);

-- CreateTable
CREATE TABLE "instructor_labs" (
    "instructor_id" INTEGER NOT NULL,
    "lab_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_labs_pkey" PRIMARY KEY ("instructor_id","lab_id")
);

-- CreateTable
CREATE TABLE "vm_requests" (
    "id" SERIAL NOT NULL,
    "student_db_id" INTEGER NOT NULL,
    "lab_id" INTEGER,
    "student_name" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "template_uuid" TEXT,
    "template_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "vm_uuid" TEXT,
    "vm_name" TEXT,
    "vm_ip" TEXT,
    "access_protocol" TEXT,
    "guac_username" TEXT,
    "guac_password" TEXT,
    "guac_connection_id" TEXT,
    "guac_data_source" TEXT,
    "guac_protocol" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vm_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'Admin',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lab_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "lab_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "note" TEXT,
    "marked_by" INTEGER,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_documents" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_path" TEXT,
    "file_type" TEXT,
    "image_url" TEXT,
    "image_type" TEXT,
    "link_url" TEXT,
    "link_title" TEXT,
    "lab_id" INTEGER NOT NULL,
    "visible_to_students" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'update',
    "message" TEXT NOT NULL,
    "user_id" TEXT,
    "user_role" TEXT,
    "lab_id" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sous_groupes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "lab_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sous_groupes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sous_groupe_members" (
    "id" SERIAL NOT NULL,
    "sous_groupe_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,

    CONSTRAINT "sous_groupe_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "binomes" (
    "id" SERIAL NOT NULL,
    "sous_groupe_id" INTEGER NOT NULL,
    "student_1_id" INTEGER NOT NULL,
    "student_2_id" INTEGER,

    CONSTRAINT "binomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reactions" (
    "id" SERIAL NOT NULL,
    "announcement_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "reaction" TEXT NOT NULL DEFAULT 'acknowledged',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_role" TEXT NOT NULL DEFAULT 'student',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "lab_id" INTEGER,
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_records" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_role" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "token_jti" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logout_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "session_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_links" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "lab_id" INTEGER NOT NULL,
    "added_by" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_records" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "sender_role" TEXT NOT NULL,
    "receiver_id" INTEGER NOT NULL,
    "receiver_role" TEXT NOT NULL,
    "lab_id" INTEGER,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "lab_id" INTEGER NOT NULL,
    "instructor_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "show_results" TEXT NOT NULL DEFAULT 'immediate',
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "passing_score" DOUBLE PRECISION,
    "sous_groupe_id" INTEGER,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT,
    "correct_answer" TEXT,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "time_spent" INTEGER,
    "score" DOUBLE PRECISION,
    "total_points" DOUBLE PRECISION,
    "max_points" DOUBLE PRECISION,
    "passed" BOOLEAN,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_answers" (
    "id" SERIAL NOT NULL,
    "attempt_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "answer" TEXT,
    "points_earned" DOUBLE PRECISION,

    CONSTRAINT "exam_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" SERIAL NOT NULL,
    "year" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_student_id_key" ON "students"("student_id");

-- CreateIndex
CREATE INDEX "grade_columns_lab_id_idx" ON "grade_columns"("lab_id");

-- CreateIndex
CREATE UNIQUE INDEX "grade_columns_name_lab_id_key" ON "grade_columns"("name", "lab_id");

-- CreateIndex
CREATE INDEX "grades_column_id_idx" ON "grades"("column_id");

-- CreateIndex
CREATE UNIQUE INDEX "instructors_username_key" ON "instructors"("username");

-- CreateIndex
CREATE INDEX "instructors_lab_id_idx" ON "instructors"("lab_id");

-- CreateIndex
CREATE INDEX "student_labs_lab_id_idx" ON "student_labs"("lab_id");

-- CreateIndex
CREATE INDEX "instructor_labs_lab_id_idx" ON "instructor_labs"("lab_id");

-- CreateIndex
CREATE INDEX "instructor_labs_instructor_id_idx" ON "instructor_labs"("instructor_id");

-- CreateIndex
CREATE INDEX "vm_requests_status_idx" ON "vm_requests"("status");

-- CreateIndex
CREATE INDEX "vm_requests_student_db_id_idx" ON "vm_requests"("student_db_id");

-- CreateIndex
CREATE INDEX "vm_requests_lab_id_idx" ON "vm_requests"("lab_id");

-- CreateIndex
CREATE INDEX "announcements_lab_id_idx" ON "announcements"("lab_id");

-- CreateIndex
CREATE INDEX "announcements_pinned_idx" ON "announcements"("pinned");

-- CreateIndex
CREATE INDEX "attendance_date_idx" ON "attendance"("date");

-- CreateIndex
CREATE INDEX "attendance_lab_id_idx" ON "attendance"("lab_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_student_id_date_lab_id_key" ON "attendance"("student_id", "date", "lab_id");

-- CreateIndex
CREATE INDEX "lab_documents_lab_id_idx" ON "lab_documents"("lab_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_type_idx" ON "activity_logs"("type");

-- CreateIndex
CREATE INDEX "sous_groupes_lab_id_idx" ON "sous_groupes"("lab_id");

-- CreateIndex
CREATE INDEX "sous_groupe_members_sous_groupe_id_idx" ON "sous_groupe_members"("sous_groupe_id");

-- CreateIndex
CREATE INDEX "sous_groupe_members_student_id_idx" ON "sous_groupe_members"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "sous_groupe_members_sous_groupe_id_student_id_key" ON "sous_groupe_members"("sous_groupe_id", "student_id");

-- CreateIndex
CREATE INDEX "binomes_sous_groupe_id_idx" ON "binomes"("sous_groupe_id");

-- CreateIndex
CREATE INDEX "announcement_reactions_announcement_id_idx" ON "announcement_reactions"("announcement_id");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reactions_announcement_id_student_id_key" ON "announcement_reactions"("announcement_id", "student_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_user_role_idx" ON "notifications"("user_id", "user_role");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE UNIQUE INDEX "session_records_token_jti_key" ON "session_records"("token_jti");

-- CreateIndex
CREATE INDEX "session_records_user_id_user_role_idx" ON "session_records"("user_id", "user_role");

-- CreateIndex
CREATE INDEX "session_records_is_active_idx" ON "session_records"("is_active");

-- CreateIndex
CREATE INDEX "resource_links_lab_id_idx" ON "resource_links"("lab_id");

-- CreateIndex
CREATE INDEX "backup_records_created_at_idx" ON "backup_records"("created_at");

-- CreateIndex
CREATE INDEX "messages_receiver_id_receiver_role_read_idx" ON "messages"("receiver_id", "receiver_role", "read");

-- CreateIndex
CREATE INDEX "messages_sender_id_sender_role_idx" ON "messages"("sender_id", "sender_role");

-- CreateIndex
CREATE INDEX "messages_lab_id_idx" ON "messages"("lab_id");

-- CreateIndex
CREATE INDEX "exams_lab_id_idx" ON "exams"("lab_id");

-- CreateIndex
CREATE INDEX "exams_instructor_id_idx" ON "exams"("instructor_id");

-- CreateIndex
CREATE INDEX "exam_questions_exam_id_idx" ON "exam_questions"("exam_id");

-- CreateIndex
CREATE INDEX "exam_attempts_exam_id_idx" ON "exam_attempts"("exam_id");

-- CreateIndex
CREATE INDEX "exam_attempts_student_id_idx" ON "exam_attempts"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_exam_id_student_id_attempt_number_key" ON "exam_attempts"("exam_id", "student_id", "attempt_number");

-- CreateIndex
CREATE INDEX "exam_answers_attempt_id_idx" ON "exam_answers"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_answers_attempt_id_question_id_key" ON "exam_answers"("attempt_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "levels_year_specialty_key" ON "levels"("year", "specialty");

-- AddForeignKey
ALTER TABLE "grade_columns" ADD CONSTRAINT "grade_columns_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "grade_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructors" ADD CONSTRAINT "instructors_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_labs" ADD CONSTRAINT "student_labs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_labs" ADD CONSTRAINT "student_labs_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_labs" ADD CONSTRAINT "instructor_labs_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_labs" ADD CONSTRAINT "instructor_labs_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vm_requests" ADD CONSTRAINT "vm_requests_student_db_id_fkey" FOREIGN KEY ("student_db_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vm_requests" ADD CONSTRAINT "vm_requests_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_documents" ADD CONSTRAINT "lab_documents_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sous_groupes" ADD CONSTRAINT "sous_groupes_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sous_groupe_members" ADD CONSTRAINT "sous_groupe_members_sous_groupe_id_fkey" FOREIGN KEY ("sous_groupe_id") REFERENCES "sous_groupes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sous_groupe_members" ADD CONSTRAINT "sous_groupe_members_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binomes" ADD CONSTRAINT "binomes_sous_groupe_id_fkey" FOREIGN KEY ("sous_groupe_id") REFERENCES "sous_groupes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binomes" ADD CONSTRAINT "binomes_student_1_id_fkey" FOREIGN KEY ("student_1_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binomes" ADD CONSTRAINT "binomes_student_2_id_fkey" FOREIGN KEY ("student_2_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reactions" ADD CONSTRAINT "announcement_reactions_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reactions" ADD CONSTRAINT "announcement_reactions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_links" ADD CONSTRAINT "resource_links_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "exam_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
