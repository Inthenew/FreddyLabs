// FREDDY IS THE BEST SOG!!! //

// PRTIALLY AI WRITTEN - YEAH I KNOW, DISGUSTING, BUT IM LAZY //

$(document).ready(function() {
    $('#title').hover(() => {
        // Slide the secreet message down from da title //
        $('#secret-message').stop(true, true).slideDown(300);
    }, () => {
        $('#secret-message').stop(true, true).slideUp(300);
    });
});
