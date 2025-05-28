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

// API Configuration
const API_BASE = 'https://v0-new-project-rbq2rqiphtt.vercel.app/api/likes';

// Cache the result for a few minutes
const CACHE_DURATION = 1 * 60 * 1000; // 1 minute
const CACHE_KEY = 'freddyLabs_likesCache';

function getLikesCache() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        return cached ? JSON.parse(cached) : {};
    } catch (error) {
        console.error('Failed to read likes cache from localStorage:', error);
        return {};
    }
}

function setLikesCache(cache) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.error('Failed to save likes cache to localStorage:', error);
    }
}

// API Functions
async function getLikesFromServer(articleId) {
    const now = Date.now();
    const likesCache = getLikesCache();
    const cached = likesCache[articleId];
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        console.log(`Using cached likes for "${articleId}": ${cached.likes}`);
        return cached.likes;
    }
    
    try {
        const resp = await fetch(`${API_BASE}?articleId=${encodeURIComponent(articleId)}`);
        
        if (resp.status === 500) {
            console.warn(`Server error (500) when fetching likes for "${articleId}". Using fallback count of 0.`);
            return 0;
        }
        
        if (!resp.ok) throw new Error(`Error fetching likes: ${resp.status}`);
        
        let data;
        try {
            data = await resp.json();
        } catch (jsonError) {
            console.error('Failed to parse JSON response:', jsonError);
            return 0; // Fallback to 0 if JSON parsing fails
        }
        
        const { likes } = data;
        
        // Update cache in localStorage
        const updatedCache = getLikesCache();
        updatedCache[articleId] = { likes: likes, timestamp: now };
        setLikesCache(updatedCache);
        
        console.log(`Fetched fresh likes for "${articleId}": ${likes}`);
        return likes;
    } catch (error) {
        console.warn(`Failed to fetch likes for "${articleId}":`, error.message);
        return 0; // Fallback to 0 if API fails
    }
}

async function addLikeToServer(articleId) {
    try {
        const resp = await fetch(API_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'plus',
                articleId: articleId
            })
        });
        if (!resp.ok) throw new Error(`Error adding like: ${resp.status}`);
        
        let data;
        try {
            data = await resp.json();
        } catch (jsonError) {
            console.error('Failed to parse JSON response:', jsonError);
            throw new Error('Invalid JSON response from server');
        }
        
        const { likes } = data;
        
        // Update cache immediately with new count
        const updatedCache = getLikesCache();
        updatedCache[articleId] = { likes: likes, timestamp: Date.now() };
        setLikesCache(updatedCache);
        
        return likes;
    } catch (error) {
        console.error('Error adding like:', error);
        throw error;
    }
}

async function removeLikeFromServer(articleId) {
    try {
        const resp = await fetch(API_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'minus',
                articleId: articleId
            })
        });
        if (!resp.ok) throw new Error(`Error removing like: ${resp.status}`);
        
        let data;
        try {
            data = await resp.json();
        } catch (jsonError) {
            console.error('Failed to parse JSON response:', jsonError);
            throw new Error('Invalid JSON response from server');
        }
        
        const { likes } = data;
        
        // Update cache immediately with new count
        const updatedCache = getLikesCache();
        updatedCache[articleId] = { likes: likes, timestamp: Date.now() };
        setLikesCache(updatedCache);
        
        return likes;
    } catch (error) {
        console.error('Error removing like:', error);
        throw error;
    }
}

// Like functionality //
function formatLikeCount(count) {
    if (count >= 1000000) {
        return Math.floor(count / 1000000) + 'm';
    } else if (count >= 1000) {
        return Math.floor(count / 1000) + 'k';
    }
    return count.toString();
}

function getLikeData(itemId) {
    const likes = JSON.parse(localStorage.getItem('freddyLabs_likes') || '{}');
    return {
        count: likes[itemId]?.count || 0,
        liked: likes[itemId]?.liked || false
    };
}

function saveLikeData(itemId, count, liked) {
    const likes = JSON.parse(localStorage.getItem('freddyLabs_likes') || '{}');
    likes[itemId] = { count, liked };
    localStorage.setItem('freddyLabs_likes', JSON.stringify(likes));
}

async function handleLike(itemId, buttonElement) {
    const $button = $(buttonElement);
    const currentData = getLikeData(itemId);
    const newLiked = !currentData.liked;
    
    // Disable button during API call
    $button.prop('disabled', true);
    $button.css('opacity', '0.7');
    
    try {
        let newCount;
        if (newLiked) {
            newCount = await addLikeToServer(itemId);
        } else {
            newCount = await removeLikeFromServer(itemId);
        }
        
        // Update localStorage and UI with server response
        saveLikeData(itemId, newCount, newLiked);
        updateLikeButton(buttonElement, newCount, newLiked);
    } catch (error) {
        console.error('Failed to update like:', error);
        // Keep the current state if API fails
    } finally {
        // Re-enable button
        $button.prop('disabled', false);
        $button.css('opacity', '1');
    }
}

function updateLikeButton(buttonElement, count, liked) {
    const $button = $(buttonElement);
    const $icon = $button.find('.like-icon');
    const $count = $button.find('.like-count');
    
    $icon.text(liked ? '❤️' : '🤍');
    $count.text(formatLikeCount(count));
    
    if (liked) {
        $button.addClass('liked');
    } else {
        $button.removeClass('liked');
    }
}

async function createLikeButton(itemId) {
    // Get current like state from localStorage (for UI responsiveness)
    const localData = getLikeData(itemId);
    
    const $button = $(`
        <button class="like-button" data-item-id="${itemId}">
            <span class="like-icon">${localData.liked ? '❤️' : '🤍'}</span>
            <span class="like-count">${formatLikeCount(localData.count)}</span>
        </button>
    `);
    
    if (localData.liked) {
        $button.addClass('liked');
    }
    
    $button.on('click', function(e) {
        e.stopPropagation(); // Prevent triggering the card click
        handleLike(itemId, this);
    });
    
    // Load actual count from server in background
    try {
        const serverCount = await getLikesFromServer(itemId);
        if (serverCount !== localData.count) {
            // Update localStorage with server data
            saveLikeData(itemId, serverCount, localData.liked);
            updateLikeButton($button[0], serverCount, localData.liked);
        }
    } catch (error) {
        console.error('Failed to load like count from server:', error);
    }
    
    return $button;
}

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
        const itemId = ting.articleId || `item_${Date.now()}_${Math.random()}`;
        
        const tingItem = $(`
            <div class="ting-item" style="background-image: url('${ting.img}');" title="${title}">
                <div class="ting-title">${title}</div>
            </div>
        `);
        
        // Add like button (async)
        createLikeButton(itemId).then(likeButton => {
            tingItem.append(likeButton);
        }).catch(error => {
            console.error('Failed to create like button:', error);
        });
        
        // Add click functionality for update items
        if (containerSelector === '#updates-container' && ting.articleId) {
            tingItem.css('cursor', 'pointer');
            tingItem.on('click', function(e) {
                // Only navigate if we didn't click the like button
                if (!$(e.target).closest('.like-button').length) {
                    window.location.href = `article.html?id=${ting.articleId}`;
                }
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
