$(document).ready(function() {
    "use strict";

    function initializeEnhanceBlock () {
        // avoid duplicate enhancement
        if ($('#enhance-su-block').html()) {
            return;
        }

        $('#overlayHeader div.venueInfo.hasRedMarker').prepend('<p id="enhance-su-block"></p>');
    }

    /**
     * Enhance search
     *
     * - Convert Bing.com link to Google.com (for "(search the web)")
     * - Add a link to Google Maps
     * - Move both link above the venue name
     */
    function enhanceSearch () {
        var searchLink = $('div.venueInfoText a.searchLink');

        // avoid duplicate enhancement
        if ($('#enhance-su-search').html() || !searchLink.html()) {
            return;
        }

        searchLink.hide();

        var hrefGoogle = searchLink
            .attr('href')
            .replace('bing.com', 'google.com/search');

        var searchGoogle = '<a target="_blank" href="'+hrefGoogle+'">Google</a>';

        var hrefMaps = 'https://maps.google.com/maps?q=' +
            $('h4 a.venue').html() + ' ' +
            $('div.venueInfoText p.addressArea').html();

        var searchMaps = '<a target="_blank" href="' + hrefMaps + '">Google Maps</a>';

        $('#enhance-su-block').append('<span id="enhance-su-search">Search on: ' + searchGoogle + ' - ' + searchMaps + '</span>');
    }

    /**
     * Display empty values from edit panel
     * to be display right now, instead of wasting one click
     *
     * - Parse all empty value from edit panel and display them above the venue name
     *   If there are more than 6 empty values, we don't list them
     */
    function displayEmptyValue () {
        // if edit panel doesn't exists or enhancement already exists
        if (!$('div.editPanes div.editPane').html() || $('#enhance-su-edit-location').html()) {
            return;
        }

        // loop through all value from the edit panel and find those with empty value
        var emptyValues = [];
        var curItem = '';
        $('li.field.simpleField :input').each(function() {
            curItem = $(this);
            if ('' === curItem.val()) {
                emptyValues.push(curItem.parent().prev('div').html());
            }
        });

        if (0 === emptyValues.length) {
            return;
        }

        var text = '<span id="enhance-su-edit-location"><b>' + emptyValues.length + '</b> empty fields: ' + emptyValues.join(', ') + '</span>';

        // display a more visible message if there is a lot of empty fields
        if (6 < emptyValues.length) {
            text = '<span id="enhance-su-edit-location"><b>' + emptyValues.length + ' empty fields !</b></span>';
        }

        $('#enhance-su-block').append(text);
    }

    // be sure that every new venue will be updated
    setInterval(function() {
        initializeEnhanceBlock();
        enhanceSearch();
        displayEmptyValue();
    }, 500);
});
