let idToUrl = {
    w: '/w',
    chat4: '/secret/chat4',
    eagler: '/secret/eagler23',
    sketchbook2: '/sketchbook/index.html',
    freddybot: '/olds/freddybot.html',
    "street-slickers": '/olds/street_slickers.html',
    "pixel-quest": '/olds/pixel_quest.html',
    project: '/current/project.html',
    buildabot: '/olds/buildabot.html',
    astraquest: '/olds/astraquest.html',
    earth: '/olds/earth.html',
    earth2: '/current/earth.html',
    boats: '/olds/boats.html',
    modelio: '/olds/modelio.html',
    ipcamera: '/olds/ipcamera.html',
    goalthingy: '/olds/goalthingy.html',
    aipres: '/olds/aipres.html',
    trains: '/olds/trains.html',
    sketchbook: '/olds/sketchbook.html',
    aerial: '/olds/aerial.html',
    baseball: '/olds/baseball.html',
    welding: '/olds/welding.html',
    creative: '/olds/creative.html',
    more: '/olds/more.html'
}

document.querySelectorAll('.ting-button').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
        let url = idToUrl[btn.id];
        if (url) {
            window.location.href = url;
        }
    });
});
