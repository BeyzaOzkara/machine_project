/*
  # Update User Roles and Add Departments

  ## Overview
  This migration restructures the system to support a department-based hierarchy
  with Admin, Team Leader, and Operator roles.

  ## Changes to Existing Tables

  ### 1. `profiles` table
  - Update role enum to include: 'admin', 'team_leader', 'operator'
  - Remove 'viewer' role (no longer needed)

  ### 2. `machines` table
  - Add `department_id` column to link machines to departments

  ## New Tables

  ### 1. `departments`
  - `id` (uuid, primary key) - Unique department identifier
  - `name` (text, unique) - Department name
  - `description` (text) - Department description
  - `created_at` (timestamptz) - Creation timestamp
  - `created_by` (uuid) - Admin who created the department

  ### 2. `department_leaders`
  Junction table for assigning team leaders to departments.
  - `id` (uuid, primary key) - Unique record identifier
  - `department_id` (uuid, foreign key) - References departments
  - `user_id` (uuid, foreign key) - Team leader user ID
  - `assigned_at` (timestamptz) - Assignment timestamp
  - `assigned_by` (uuid) - Admin who made the assignment

  ### 3. `machine_operators`
  Junction table for assigning operators to specific machines.
  - `id` (uuid, primary key) - Unique record identifier
  - `machine_id` (uuid, foreign key) - References machines
  - `user_id` (uuid, foreign key) - Operator user ID
  - `assigned_at` (timestamptz) - Assignment timestamp
  - `assigned_by` (uuid) - Admin or team leader who made the assignment

  ## Security (Row Level Security)

  ### departments table
  - All authenticated users can view departments
  - Only admins can insert, update, or delete departments

  ### department_leaders table
  - All authenticated users can view assignments
  - Only admins can manage assignments

  ### machine_operators table
  - All authenticated users can view assignments
  - Admins and team leaders can manage assignments

  ### Updated machines policies
  - Operators can only view machines they are assigned to
  - Team leaders can view machines in their departments
  - Admins can view all machines

  ## Important Notes
  1. Admins have full system access
  2. Team Leaders manage machines within their assigned departments
  3. Operators can only access machines they are explicitly assigned to
  4. First user should be manually set as admin in the database
*/

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create department_leaders table
CREATE TABLE IF NOT EXISTS department_leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id),
  UNIQUE(department_id, user_id)
);

ALTER TABLE department_leaders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view department leaders"
  ON department_leaders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage department leaders"
  ON department_leaders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create machine_operators table
CREATE TABLE IF NOT EXISTS machine_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id),
  UNIQUE(machine_id, user_id)
);

ALTER TABLE machine_operators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view machine operators"
  ON machine_operators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and team leaders can manage machine operators"
  ON machine_operators FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'team_leader')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'team_leader')
    )
  );

-- Add department_id to machines table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'machines' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE machines ADD COLUMN department_id uuid REFERENCES departments(id);
  END IF;
END $$;

-- Drop old machine policies
DROP POLICY IF EXISTS "All users can view machines" ON machines;
DROP POLICY IF EXISTS "Admins and operators can update machines" ON machines;
DROP POLICY IF EXISTS "Admins can insert machines" ON machines;

-- Create new machine policies with department-based access
CREATE POLICY "Operators can view assigned machines"
  ON machines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM department_leaders
      WHERE department_leaders.user_id = auth.uid()
      AND department_leaders.department_id = machines.department_id
    )
    OR EXISTS (
      SELECT 1 FROM machine_operators
      WHERE machine_operators.user_id = auth.uid()
      AND machine_operators.machine_id = machines.id
    )
  );

CREATE POLICY "Admins and team leaders can insert machines"
  ON machines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'team_leader'
      )
      AND EXISTS (
        SELECT 1 FROM department_leaders
        WHERE department_leaders.user_id = auth.uid()
        AND department_leaders.department_id = machines.department_id
      )
    )
  );

CREATE POLICY "Users can update machines based on role"
  ON machines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM department_leaders
      WHERE department_leaders.user_id = auth.uid()
      AND department_leaders.department_id = machines.department_id
    )
    OR EXISTS (
      SELECT 1 FROM machine_operators
      WHERE machine_operators.user_id = auth.uid()
      AND machine_operators.machine_id = machines.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM department_leaders
      WHERE department_leaders.user_id = auth.uid()
      AND department_leaders.department_id = machines.department_id
    )
    OR EXISTS (
      SELECT 1 FROM machine_operators
      WHERE machine_operators.user_id = auth.uid()
      AND machine_operators.machine_id = machines.id
    )
  );

CREATE POLICY "Admins can delete machines"
  ON machines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Update profiles role check constraint
DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'team_leader', 'operator'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update existing profiles with 'viewer' role to 'operator'
UPDATE profiles SET role = 'operator' WHERE role = 'viewer';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_machines_department ON machines(department_id);
CREATE INDEX IF NOT EXISTS idx_department_leaders_user ON department_leaders(user_id);
CREATE INDEX IF NOT EXISTS idx_department_leaders_dept ON department_leaders(department_id);
CREATE INDEX IF NOT EXISTS idx_machine_operators_user ON machine_operators(user_id);
CREATE INDEX IF NOT EXISTS idx_machine_operators_machine ON machine_operators(machine_id);

-- Insert sample departments
INSERT INTO departments (name, description) VALUES
  ('Production Floor A', 'Main production line with CNC and assembly machines'),
  ('Quality Control', 'Quality inspection and testing equipment'),
  ('Maintenance Workshop', 'Machine maintenance and repair area')
ON CONFLICT (name) DO NOTHING;

-- Update existing machines to assign them to departments
DO $$
DECLARE
  dept_id uuid;
BEGIN
  SELECT id INTO dept_id FROM departments WHERE name = 'Production Floor A' LIMIT 1;
  
  IF dept_id IS NOT NULL THEN
    UPDATE machines SET department_id = dept_id 
    WHERE machine_code IN ('M001', 'M002') AND department_id IS NULL;
    
    SELECT id INTO dept_id FROM departments WHERE name = 'Quality Control' LIMIT 1;
    UPDATE machines SET department_id = dept_id 
    WHERE machine_code IN ('M003', 'M004') AND department_id IS NULL;
    
    SELECT id INTO dept_id FROM departments WHERE name = 'Maintenance Workshop' LIMIT 1;
    UPDATE machines SET department_id = dept_id 
    WHERE machine_code = 'M005' AND department_id IS NULL;
  END IF;
END $$;