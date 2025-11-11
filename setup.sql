-- Create the guests table for wedding RSVP system
CREATE TABLE IF NOT EXISTS guests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    address TEXT,
    phone TEXT,
    rsvp TEXT CHECK (rsvp IN ('yes', 'no')),
    meal_choice TEXT CHECK (meal_choice IN ('chicken', 'beef', 'fish', 'vegetarian')),
    song_request TEXT,
    dietary_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create an index on names for faster lookups
CREATE INDEX idx_guests_name ON guests(first_name, last_name);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function when a row is updated
CREATE TRIGGER update_guests_updated_at
    BEFORE UPDATE ON guests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample guest data (optional - remove or modify as needed)
INSERT INTO guests (first_name, last_name, email, address, phone)
VALUES 
    ('John', 'Smith', 'john.smith@example.com', '123 Main Street, Pontiac, MI 48342', '555-0100'),
    ('Jane', 'Doe', 'jane.doe@example.com', '456 Oak Avenue, Pontiac, MI 48342', '555-0101'),
    ('Bob', 'Johnson', 'bob.johnson@example.com', '789 Elm Drive, Pontiac, MI 48342', '555-0102');

-- View all guests
-- SELECT * FROM guests ORDER BY last_name, first_name;

