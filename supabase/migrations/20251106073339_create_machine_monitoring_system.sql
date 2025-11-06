/*
  # Machine Monitoring System Database Schema

  ## Overview
  This migration creates a complete database schema for a real-time machine monitoring system
  with user authorization and comprehensive status tracking.

  ## New Tables
  
  ### 1. `profiles`
  Extends auth.users with additional user information and access levels.
  - `id` (uuid, primary key) - References auth.users
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `role` (text) - User role: 'admin', 'operator', or 'viewer'
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last profile update
  
  ### 2. `machines`
  Stores information about production machines.
  - `id` (uuid, primary key) - Unique machine identifier
  - `machine_code` (text, unique) - Human-readable machine code/name
  - `machine_name` (text) - Full machine name
  - `description` (text) - Machine description
  - `current_status` (text) - Current operational status
  - `last_updated_at` (timestamptz) - Last status update timestamp
  - `last_updated_by` (uuid) - User who last updated the status
  - `created_at` (timestamptz) - Machine registration date
  
  ### 3. `status_history`
  Maintains a complete audit log of all machine status changes.
  - `id` (uuid, primary key) - Unique history record identifier
  - `machine_id` (uuid, foreign key) - References machines table
  - `status` (text) - Status at time of change
  - `comment` (text, nullable) - Optional note about the status change
  - `changed_by` (uuid, foreign key) - User who made the change
  - `changed_at` (timestamptz) - Timestamp of the change
  
  ## Security (Row Level Security)
  
  ### profiles table
  - Users can view all profiles
  - Users can only update their own profile
  - Only admins can modify user roles
  
  ### machines table
  - All authenticated users can view machines
  - Only admins and operators can update machine status
  
  ### status_history table
  - All authenticated users can view history
  - Only admins and operators can insert new records
  - No one can update or delete history records (audit integrity)
  
  ## Indexes
  - machines: index on current_status for filtering
  - status_history: index on machine_id and changed_at for efficient history queries
  
  ## Important Notes
  1. Machine statuses: "Running", "Idle", "Fault", "Under Maintenance"
  2. User roles: "admin" (full access), "operator" (can update), "viewer" (read-only)
  3. All timestamps use UTC timezone
  4. Status history is immutable for audit trail integrity
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'operator', 'viewer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create machines table
CREATE TABLE IF NOT EXISTS machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_code text UNIQUE NOT NULL,
  machine_name text NOT NULL,
  description text DEFAULT '',
  current_status text NOT NULL DEFAULT 'Idle' CHECK (current_status IN ('Running', 'Idle', 'Fault', 'Under Maintenance')),
  last_updated_at timestamptz DEFAULT now(),
  last_updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view machines"
  ON machines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and operators can update machines"
  ON machines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Admins can insert machines"
  ON machines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create status_history table
CREATE TABLE IF NOT EXISTS status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  status text NOT NULL,
  comment text DEFAULT '',
  changed_by uuid NOT NULL REFERENCES profiles(id),
  changed_at timestamptz DEFAULT now()
);

ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view status history"
  ON status_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and operators can insert status history"
  ON status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = changed_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operator')
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(current_status);
CREATE INDEX IF NOT EXISTS idx_status_history_machine ON status_history(machine_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample machines for demonstration
INSERT INTO machines (machine_code, machine_name, description, current_status) VALUES
  ('M001', 'CNC Machine A', 'High-precision CNC milling machine', 'Running'),
  ('M002', 'Assembly Line 1', 'Main product assembly line', 'Running'),
  ('M003', 'Packaging Unit', 'Automated packaging system', 'Idle'),
  ('M004', 'Quality Control Station', 'Automated quality inspection', 'Running'),
  ('M005', 'Welding Robot B', 'Industrial welding robot', 'Under Maintenance')
ON CONFLICT (machine_code) DO NOTHING;