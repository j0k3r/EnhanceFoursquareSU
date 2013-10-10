$(document).ready(function() {

    function enhanceSearch () {
        // avoid duplicate enhancement
        if ($('#enhance-su-google-maps').html()) {
            return;
        }

        searchLink = $('div.venueInfoText a.searchLink');
        searchLink.hide();

        hrefGoogle = searchLink
            .attr('href')
            .replace('bing.com', 'google.com/search');

        searchGoogle = '<a target="_blank" href="'+hrefGoogle+'">Google</a>';

        hrefMaps = 'https://maps.google.com/maps?q=' +
            $('h4 a.venue').html() + ' ' +
            $('div.venueInfoText p.addressArea').html();

        searchMaps = '<a target="_blank" href="' + hrefMaps + '">Google Maps</a>';

        $('#overlayHeader div.venueInfo.hasRedMarker').prepend('<p id="enhance-su-google-maps">Search on: ' + searchGoogle + ' - ' + searchMaps + '</p>');
    }

    // be sure that every new venue will be updated
    setInterval(function() {
        enhanceSearch();
    }, 500);
});
