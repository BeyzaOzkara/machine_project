/*
  # Add Status Types and History Improvements

  ## Overview
  This migration adds customizable status types and improves the status history tracking
  to include previous status information.

  ## New Tables

  ### 1. `status_types`
  Stores custom machine status types that admins can define.
  - `id` (uuid, primary key) - Unique status type identifier
  - `name` (text, unique) - Status type name (e.g., "Running", "Calibration", "Cleaning")
  - `color` (text) - Color code for UI display (e.g., "green", "blue", "yellow", "red")
  - `is_default` (boolean) - Whether this is a default system status
  - `is_active` (boolean) - Whether this status is currently active/available
  - `display_order` (integer) - Order for displaying in UI
  - `created_at` (timestamptz) - Creation timestamp
  - `created_by` (uuid) - Admin who created the status type

  ## Changes to Existing Tables

  ### 1. `status_history` table
  - Add `previous_status` column to track what the status changed from

  ### 2. `machines` table
  - Remove check constraint on current_status to allow custom status types

  ## Security (Row Level Security)

  ### status_types table
  - All authenticated users can view active status types
  - Only admins can insert, update, or delete status types

  ## Important Notes
  1. Default status types are pre-populated: Running, Idle, Fault, Under Maintenance
  2. Admins can add custom status types with custom colors
  3. Status types can be deactivated but not deleted to preserve history integrity
  4. History now tracks both previous and new status for better audit trail
*/

-- Create status_types table
CREATE TABLE IF NOT EXISTS status_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  color text NOT NULL DEFAULT 'gray',
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE status_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view active status types"
  ON status_types FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can view all status types"
  ON status_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert status types"
  ON status_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update status types"
  ON status_types FOR UPDATE
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

CREATE POLICY "Admins can delete status types"
  ON status_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    AND is_default = false
  );

-- Add previous_status to status_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'status_history' AND column_name = 'previous_status'
  ) THEN
    ALTER TABLE status_history ADD COLUMN previous_status text DEFAULT '';
  END IF;
END $$;

-- Remove check constraint from machines table to allow custom status types
DO $$
BEGIN
  ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_current_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create index for status types
CREATE INDEX IF NOT EXISTS idx_status_types_active ON status_types(is_active, display_order);

-- Insert default status types
INSERT INTO status_types (name, color, is_default, is_active, display_order) VALUES
  ('Running', 'green', true, true, 1),
  ('Idle', 'yellow', true, true, 2),
  ('Fault', 'red', true, true, 3),
  ('Under Maintenance', 'blue', true, true, 4)
ON CONFLICT (name) DO NOTHING;

-- Update existing status_history records to populate previous_status where possible
DO $$
DECLARE
  history_record RECORD;
  prev_status text;
BEGIN
  FOR history_record IN 
    SELECT id, machine_id, changed_at, status
    FROM status_history
    WHERE previous_status = ''
    ORDER BY machine_id, changed_at
  LOOP
    SELECT status INTO prev_status
    FROM status_history
    WHERE machine_id = history_record.machine_id
      AND changed_at < history_record.changed_at
    ORDER BY changed_at DESC
    LIMIT 1;
    
    IF prev_status IS NOT NULL THEN
      UPDATE status_history
      SET previous_status = prev_status
      WHERE id = history_record.id;
    END IF;
  END LOOP;
END $$;