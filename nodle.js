// FREDDY IS THE BEST SOG!!! //

// PRTIALLY AI WRITTEN - YEAH I KNOW, DISGUSTING, BUT IM LAZY //

$(document).ready(function () {
    // Cumputer //
    $('#title').hover(() => {
        // Slide the secreet message down from da title //
        $('#secret-message').stop(true, true).slideDown(300);
    }, () => {
        $('#secret-message').stop(true, true).slideUp(300);
    });

    // Mobile //
    $('#title').on('touchstart', function (e) {
        e.preventDefault();
        const secretMessage = $('#secret-message');

        if (secretMessage.is(':visible')) {
            secretMessage.stop(true, true).slideUp(300);
        } else {
            secretMessage.stop(true, true).slideDown(300);
        }
    });
});


// Actual tings //

// my stuff tings //
let my_stuff_tings = [
];

// da updates //
let update_tings = [
    {
        info: "Modeling start - motor attachment",
        img: "images/first.png",
        articleId: "modeling-start-motor-attachment"
    }
];

function renderTings(tings, containerSelector) {
    const $container = $(containerSelector);
    $container.empty();
    for (const ting of tings) {
        // Set the background image directly on the ting-item
        // Add a fallback for ting.info in case it's undefined or empty
        const title = ting.info || 'Untitled';
        const tingItem = $(`
            <div class="ting-item" style="background-image: url('${ting.img}');" title="${title}">
                <div class="ting-title">${title}</div>
            </div>
        `);
        
        // Add click functionality for update items
        if (containerSelector === '#updates-container' && ting.articleId) {
            tingItem.css('cursor', 'pointer');
            tingItem.on('click', function() {
                window.location.href = `article.html?id=${ting.articleId}`;
            });
        }
        
        $container.append(tingItem);
    }
}

// Render both sections on document ready
$(document).ready(function () {
    // Render cards
    renderTings(my_stuff_tings, '#my-stuff-container');
    renderTings(update_tings, '#updates-container');
});
