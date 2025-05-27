// FREDDY IS THE BEST SOG!!! //

// PRTIALLY AI WRITTEN - YEAH I KNOW, DISGUSTING, BUT IM LAZY //

$(document).ready(function() {
    // Cumputer //
    $('#title').hover(() => {
        // Slide the secreet message down from da title //
        $('#secret-message').stop(true, true).slideDown(300);
    }, () => {
        $('#secret-message').stop(true, true).slideUp(300);
    });
    
    // Mobile //
    $('#title').on('touchstart', function(e) {
        e.preventDefault();
        const secretMessage = $('#secret-message');
        
        if (secretMessage.is(':visible')) {
            secretMessage.stop(true, true).slideUp(300);
        } else {
            secretMessage.stop(true, true).slideDown(300);
        }
    });
});
