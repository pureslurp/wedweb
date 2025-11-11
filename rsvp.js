// RSVP Form Handler
document.getElementById('rsvpForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const guestName = document.getElementById('guestName').value.trim();
    
    if (guestName) {
        // For now, just log the name
        // Later this will connect to Supabase
        console.log('Guest name submitted:', guestName);
        
        // Provide user feedback
        alert(`Thank you, ${guestName}! Your name has been recorded.`);
        
        // Clear the form
        document.getElementById('guestName').value = '';
    }
});

