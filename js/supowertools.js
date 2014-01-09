(function () {
    "use strict";
    // var gmapsApi = 'http://maps.kimtrip.net';
    var gmapsApi = '//maps.googleapis.com/maps/api/geocode/json',
        jsonCompanies = '//rawgithub.com/j0k3r/SUPowerTools/master/companies.json',
        oldAddressValues = {},
        companies = [];

    // full list: home_remove|home_recategorize|home_claim|not_closed|un_delete|public|private|undelete|doesnt_exist|event_over|inappropriate|duplicate|closed|mislocated
    var flagReasons = {
        'mislocated': 'mislocated',
        'closed': 'closed',
        'inappropriate': 'offensive or inappropriate',
        'doesnt_exist': "doesn't exist",
        'event_over': 'an event that has ended',
        'home_recategorize': 'a home',
    };

    // value that won't be shown as empty in /edit part
    // we use only key for fastest search (using hasOwnProperty)
    var excludeEmptyValues = {
        'crossStreet': '',
        'twitter': '',
        'url': ''
    };

    // threshold to make empty value bolder for a better look
    var thresholdAlertEmptyValues = 6 - Object.keys(excludeEmptyValues).length;

    // global Foursquare Object
    var foursquareNotifier,
        foursquareApiVenue,
        foursquareStorage;

    var flagInfos = { comment: 'Marked via SU Power Tools' };

    /**
     * convert "Centre Commercial" in "C.C"
     *
     * @return name updated (or not)
     */
    String.prototype.convertCC = function convertCC() {
        var regexCC = new RegExp('centre commercial', "i");
        if (regexCC.exec(this)) {
            return this.replace(/centre commercial/i, 'C.C');
        }

        return this;
    };

    /**
     * Set first letter to lower case.
     * Used for route name
     *
     * @from http://stackoverflow.com/a/1026087/569101
     */
    String.prototype.lowercaseFirstLetter = function lowercaseFirstLetter() {
        return this.charAt(0).toLowerCase() + this.slice(1);
    };

    /**
     * Some initilizations at first
     */
    function initialize() {
        // initialize the Foursquare notifier
        if (typeof foursquareNotifier === "undefined") {
            foursquareNotifier = fourSq.ui.Notifier.getInstance();
        }

        // initialize the Foursquare Venue API
        if (typeof foursquareApiVenue === "undefined") {
            foursquareApiVenue = fourSq.api.services.Venue;
        }

        // initialize the Foursquare local storage
        if (typeof foursquareStorage === "undefined") {
            foursquareStorage = fourSq.util.localStorage;
        }

        // load companies
        $.getJSON(jsonCompanies, function (data) {
            companies = data;
        });
    }

    /**
     * update field and set the input to green to indicate the field has been update
     *
     * @param  string value Updated value
     *
     * @return true         To indicate the field has been updated
     */
    function updateFields(element, value) {
        element.val(value).change();
        element.css('color', 'limegreen');

        return true;
    }

    function initializeEnhanceBlock() {
        // avoid duplicate enhancement
        if ($('#su-powertools-block').html()) {
            return;
        }

        $('#overlayHeader div.venueInfo.hasRedMarker').prepend('<p id="su-powertools-block"></p>');
    }

    /**
     * Enhance search in /edit
     *
     * - Convert Bing.com link to Google.com (for "(search the web)")
     * - Add a link to Google Maps
     * - Move both link above the venue name
     */
    function enhanceSearch() {
        var searchLink = $('div.venueInfoText a.searchLink');

        // avoid duplicate enhancement
        if ($('#su-powertools-search').html() || !searchLink.html()) {
            return;
        }

        searchLink.hide();

        var hrefGoogle = searchLink
            .attr('href')
            .replace('bing.com', 'google.com/search');

        var searchGoogle = '<a target="_blank" href="' + hrefGoogle + '">Google</a>';

        // remove crossStreet from address to get more accurate results
        var address = $('div.venueInfoText p.addressArea').html();
        var crossStreet = $('li.field.simpleField[data-key="crossStreet"] input').val();
        if ('' !== crossStreet) {
            address = address.replace(' (' + crossStreet + ')', '');
        }

        var hrefMaps = 'https://maps.google.com/maps?q=' +
            encodeURIComponent($('h4 a:first').html()) + ' ' +
            encodeURIComponent(address);

        var searchMaps = '<a target="_blank" href="' + hrefMaps + '">Google Maps</a>';

        $('#su-powertools-block').append('<span id="su-powertools-search">Search on: ' + searchGoogle + ' - ' + searchMaps + '</span>');

        // add twitter next to the venue url
        var twitter = $('li.field.simpleField[data-key="twitter"] input').val();
        if (typeof twitter !== "undefined" && '' !== twitter) {
            var venueUrl = $('div.venueInfoText p.venueUrl');
            if (!venueUrl.length) {
                $('div.venueInfoText').append('<p class="venueUrl"></p>');
            }
            $('div.venueInfoText p.venueUrl').append(' - <a class="url" href="http://twitter.com/' + twitter + '" target="_blank">@' + twitter + '</a>');
        }
    }

    /**
     * Add search links to Google & Google Maps in the "suggest edit" panel
     */
    function enhanceSearchSuggestEdit() {
        // avoid duplicate enhancement
        if ($('#su-powertools-auto-address').html()) {
            return;
        }

        $('<div class="suggest-edit" id="su-powertools-auto-address"></div>').insertAfter('input.formStyle.venueNameInput.flagEditInput');

        // add Google link
        var hrefGoogle = 'https://www.google.com/search?q=' +
            encodeURIComponent($('input.formStyle.venueNameInput.flagEditInput').val()) + ' ' +
            encodeURIComponent($('input.formStyle.flagEditInput.location').val());

        $('#su-powertools-auto-address').append('Search on: <a target="_blank" href="' + hrefGoogle + '">Google</a>');

        // add Google Maps link
        var hrefMaps = 'https://maps.google.com/maps?q=' +
            encodeURIComponent($('div.accordianHeader.expandable div.headerVenueText').html());

        $('#su-powertools-auto-address').append(' - <a target="_blank" href="' + hrefMaps + '">Google Maps</a>');
    }

    /**
     * Display empty values from edit panel
     * to be display right now, instead of wasting one click
     *
     * - Parse all empty value from edit panel and display them above the venue name
     *   If there are more than 6 empty values, we don't list them
     */
    function displayEmptyValue() {
        // if edit panel doesn't exists or enhancement already exists
        var editPanel = $('div.editPanes div.editPane');
        if (!editPanel.html() || $('#su-powertools-edit-location').html()) {
            return;
        }

        // loop through all value from the edit panel and find those with empty value
        var emptyValues = [];
        var curItem = '';
        editPanel.find('li.field.simpleField :input').each(function () {
            curItem = $(this);

            // exclude unwanted empty value
            if ('' === curItem.val() && !excludeEmptyValues.hasOwnProperty(curItem.parents('li.field').first().data('key'))) {
                emptyValues.push(curItem.parent().prev('div').html());
            }
        });

        if (0 === emptyValues.length) {
            return;
        }

        var text = '<span id="su-powertools-edit-location"><b>' + emptyValues.length + '</b> empty fields: ' + emptyValues.join(', ') + '</span>';

        // display a more visible message if there is a lot of empty fields
        if (thresholdAlertEmptyValues < emptyValues.length) {
            text = '<span id="su-powertools-edit-location"><b>' + emptyValues.length + ' empty fields !</b></span>';
        }

        $('#su-powertools-block').append(text);
    }

    /**
     * Add a dropdown select above the venue to quickly flag it.
     * It store the action in the localStorage, to avoid multiple report.
     *
     * @todo : remove flag from localStorage
     */
    function displayFlagOptions() {
        var editPane = $('div.editPanes div.editPane');

        // if edit panel doesn't exists or enhancement already exists
        if (!editPane.html() || $('#su-powertools-flag-options').html()) {
            return;
        }

        // check if current venue has already been flagged
        var storageKey = 'SPT-flag-'+editPane.data('venueid');
        if (true === foursquareStorage.exists(storageKey)) {
            // @todo: check if the flag is gone

            $('#su-powertools-block').append('<span id="su-powertools-flag-options"><strong>Already flagged as: ' + flagReasons[foursquareStorage.get(storageKey)] + '</strong></span>');

            return;
        }

        // build dropdown options
        var select = '<select><option>(none)</option>';
        $.each(flagReasons, function (key, value) {
            select += '<option value="' + key + '">' + value + '</option>';
        });
        select += '</select>';

        $('#su-powertools-block').append('<span id="su-powertools-flag-options">Flag as: ' + select + '</span>');

        $('#su-powertools-flag-options select').change(function selectFlag() {
            var problem = $(this).val();

            if ('' === problem) {
                return;
            }

            if (false === confirm('Do you want to flag this venue with problem: "' + problem + '"')) {
                // re-select the "(none)" option
                $(this).children('option').first().prop('selected', true);
                return;
            }

            flagInfos.problem = problem;

            // do flag venue
            foursquareApiVenue.flag(
                editPane.data('venueid'),
                flagInfos,
                function handleSuccess() {
                    // store new flag for this venue
                    foursquareStorage.set(storageKey, problem);

                    foursquareNotifier.info('Venue reported as "' + flagReasons[problem] + '".');

                    $('#su-powertools-flag-options').html('Flagged as: <strong>' + flagReasons[problem] + '</strong> !');
                },
                function handleError (response) {
                    foursquareNotifier.error('Error: ' + response.response.meta.errorDetail);
                }
            );
        });
    }

    /**
     * Display a link below the "Edit this location" in edition panel
     * to automatically update address fields (address, state, zip & city) using Google Maps
     * It's displayed only when we have an address in the form.
     */
    function displayFixAddress() {
        var editPane = $('div.editPanes div.editPane');

        // if edit panel doesn't exists or enhancement already exists
        if (!editPane.html() || $('#su-powertools-auto-address a.fix-address').html() || !foursquareStorage.exists('SPT-gmap-key')) {
            return;
        }

        // since this function is used in an ajax environment, we need to ensure that oldAddressValues
        // is empty after the first enhancement
        oldAddressValues = {};

        $('div.editPanes div.editPane h3').append('<div id="su-powertools-auto-address"><a class="fix-address" href="#">Fix address</a> <img style="display: none" src="//i.imgur.com/Srmlo6N.gif" /></div>');

        var addressFields = {
            name: $('li.field.simpleField[data-key="name"] input'),
            address: $('li.field.simpleField[data-key="address"] input'),
            state: $('li.field.simpleField[data-key="state"] input'),
            zip: $('li.field.simpleField[data-key="zip"] input'),
            city: $('li.field.simpleField[data-key="city"] input'),
            twitter: $('li.field.simpleField[data-key="twitter"] input'),
            url: $('li.field.simpleField[data-key="url"] input')
        };

        // request the foursquare api to get lat/long values in any case
        foursquareApiVenue.detail(
            editPane.data('venueid'),
            function (venue) {
                doBindFixAddress(
                    addressFields,
                    'div.editPanes div.editPane h3',
                    '',
                    function calcQuery (addressFields) {
                        // attach address to city
                        if (addressFields.city.val() && addressFields.address.val()) {
                            return addressFields.address.val() + ' ' + addressFields.city.val();
                        }

                        // use lat & long if it is given and the address field is empty
                        return venue.location.lat + ',' + venue.location.lng;
                    }
                );
            }
        );
    }

    /**
     * Bind the link to fix address in /edit
     *
     * @param  object   addressFields
     * @param  string   insertMessageAfter  @see setAddressFromGoogle
     * @param  string   latlong             Lat & long
     * @param  function queryCallBack       Callback to generate the query
     */
    function doBindFixAddress(addressFields, insertMessageAfter, latlong, queryCallBack) {
        $('#su-powertools-auto-address a.fix-address').bind('click', function updateAddress() {
            setAddressFromGoogle(
                queryCallBack(addressFields, latlong),
                addressFields,
                $(this).next('img'),
                insertMessageAfter
            );

            // it's coming from a link, so we cancel the href '#'
            return false;
        });
    }

    /**
     * Display a link below the big input for the venue name in the "suggest edit" panel
     * to automatically update address fields (address, state, zip & city) using Google Maps
     * It can use latitude/longitude if no address are defined
     */
    function displayFixAddressSuggestEdit() {
        // if edit panel doesn't exists or enhancement link already exists
        if (!$('div.modalLoadingContainer div.inputArea').html() || $('#su-powertools-auto-address a.fix-address').html() || !foursquareStorage.exists('SPT-gmap-key')) {
            return;
        }

        // if there is no address, we won't try to improve it automatically
        var address = $('input.formStyle.flagEditInput.address'),
            latlong = $('input.formStyle.flagEditInput.ll');
        if ('' === address.val() && '' === latlong.val()) {
            return;
        }

        var cityAutocomplete = $('div.flagVenueInfo.cityAutocomplete');
        if (cityAutocomplete) {
            cityAutocomplete.addClass('manualLocationOverride');
        }

        $('#su-powertools-auto-address').append('<br/>Or <a class="fix-address" href="#">fix the address</a> <img style="display: none" src="//i.imgur.com/Srmlo6N.gif" />');

        var addressFields = {
            name: $('input.formStyle.venueNameInput.flagEditInput'),
            address: $('input.formStyle.flagEditInput.address'),
            state: $('input.formStyle.flagEditInput.state'),
            zip: $('input.formStyle.flagEditInput.zip'),
            city: $('input.formStyle.flagEditInput.city'),
            location: $('input.formStyle.flagEditInput.location'),
            twitter: $('input.formStyle.flagEditInput.twitter'),
            url: $('input.formStyle.flagEditInput.url')
        };

        // bind link
        doBindFixAddress(
            addressFields,
            '#su-powertools-auto-address',
            latlong,
            function calcSuggestQuery (addressFields, latlong) {
                // attach address to location
                if (addressFields.location.val() && addressFields.address.val()) {
                    return addressFields.address.val() + ' ' + addressFields.location.val();
                }

                // use lat & long if it is given and the address field is empty
                return latlong.val();
            }
        );
    }

    /**
     * Bind the rollback link
     *
     * @param  object addressFields
     */
    function bindAddressRollBack(addressFields) {
        // once the rollback is display, we won't reload it
        if ($('#su-powertools-auto-address-rollback').html()) {
            return;
        }

        $('<span> - </span><a href="#" id="su-powertools-auto-address-rollback">rollback change</a>').insertAfter('#su-powertools-auto-address a.fix-address');

        // handle cancel button click (and closing button - on the top right)
        // Foursquare will already re-apply old values, we just need to remove rollback link
        // and re-apply default color
        $('div.buttons span.cancelEditButton, div.editPane span.xButton').bind(
            'click',
            {addressFormFields: addressFields},
            function handleCancelButton(event) {
                $('.su-powertools-message-error').remove();
                $('.su-powertools-message-warning').remove();

                event.data.addressFormFields.name.css('color', '#4d4d4d');
                event.data.addressFormFields.address.css('color', '#4d4d4d');
                event.data.addressFormFields.zip.css('color', '#4d4d4d');
                event.data.addressFormFields.state.css('color', '#4d4d4d');
                event.data.addressFormFields.city.css('color', '#4d4d4d');
                event.data.addressFormFields.twitter.css('color', '#4d4d4d');
                event.data.addressFormFields.url.css('color', '#4d4d4d');

                var rollbackBlock = $('#su-powertools-auto-address-rollback');
                rollbackBlock.prev('span').remove();
                rollbackBlock.remove();

                oldAddressValues = {};
            }
        );

        $('#su-powertools-auto-address-rollback').bind(
            'click',
            {addressFormFields: addressFields},
            function handleCancelButton(event) {
                doAddressRollback(this, event.data.addressFormFields);

                // it's coming from a link, so we cancel the href '#'
                return false;
            }
        );
    }

    /**
     * It actually DO the rollback only
     */
    function doAddressRollback(element, addressFields) {
        // clean message since we rollback
        $('.su-powertools-message-error').remove();
        $('.su-powertools-message-warning').remove();

        addressFields.name.val(oldAddressValues.name);
        addressFields.name.css('color', '#4d4d4d');

        addressFields.address.val(oldAddressValues.address);
        addressFields.address.css('color', '#4d4d4d');

        addressFields.zip.val(oldAddressValues.zip);
        addressFields.zip.css('color', '#4d4d4d');

        addressFields.state.val(oldAddressValues.state);
        addressFields.state.css('color', '#4d4d4d');

        addressFields.city.val(oldAddressValues.city);
        addressFields.city.css('color', '#4d4d4d');

        // handle location field on suggest edit
        if (typeof oldAddressValues.location !== "undefined") {
            addressFields.location.val(oldAddressValues.location);
            addressFields.location.css('color', '#4d4d4d');
        }

        addressFields.twitter.val(oldAddressValues.twitter);
        addressFields.twitter.css('color', '#4d4d4d');

        addressFields.url.val(oldAddressValues.url);
        addressFields.url.css('color', '#4d4d4d');

        // rollback is done, remove link and reset old values
        $(element).prev('span').remove();
        $(element).remove();
        oldAddressValues = {};
    }

    /**
     * Took an address and (optionnaly) a city and update form address with Google results
     *
     * @param  string  query
     * @param  object  addressFormFields    Fields from the form
     * @param  element loadingImg           Element to show/hide for interactivity
     */
    function setAddressFromGoogle(query, addressFormFields, loadingImg, insertMessageAfter) {
        $('.su-powertools-message-error').remove();
        $('.su-powertools-message-warning').remove();

        loadingImg.show();

        // keep old value to be able to rollback
        if (jQuery.isEmptyObject(oldAddressValues)) {
            oldAddressValues = {
                name: addressFormFields.name.val(),
                address: addressFormFields.address.val(),
                state: addressFormFields.state.val(),
                zip: addressFormFields.zip.val(),
                city: addressFormFields.city.val(),
                twitter: addressFormFields.twitter.val(),
                url: addressFormFields.url.val()
            };

            if (typeof addressFormFields.location !== "undefined") {
                oldAddressValues.location = addressFormFields.location.val();
            }
        }

        // will be set to true if one element of the address is updated
        // it will allow us to add a rollback link in that case
        var addressUpdated = false;

        var dataUrl = "sensor=false&address=" + encodeURIComponent(query);

        $.ajax({
            type: "GET",
            url: gmapsApi,
            data: dataUrl,
            dataType: "json",
            success: function (data) {
                if (data.status !== "OK") {
                    loadingImg.hide();
                    foursquareNotifier.info('Google did not find a matching address: ' + data.status);
                    return;
                }

                var gRoute = "",
                    gStreeNumber = "",
                    gLocality = "",
                    gPostalTown = "",
                    gAreaLvl1 = "",
                    gAreaLvl1Short = "",
                    gAreaLvl2 = "",
                    gZip = "",
                    gCountry = "";

                // empty result ? Do nothing.
                if (data.results.length <= 0) {
                    loadingImg.hide();
                    return;
                }

                for (var i = data.results[0].address_components.length - 1; i >= 0; i--) {
                    var addressComponent = data.results[0].address_components[i];
                    if (addressComponent.types.indexOf("route") > -1) {
                        gRoute = addressComponent.long_name.trim();
                    } else {
                        if (addressComponent.types.indexOf("street_number") > -1) {
                            gStreeNumber = addressComponent.long_name.trim().toLowerCase();
                        } else {
                            if (addressComponent.types.indexOf("locality") > -1) {
                                gLocality = addressComponent.long_name.trim();
                            } else {
                                if (addressComponent.types.indexOf("postal_code") > -1) {
                                    gZip = addressComponent.long_name.trim();
                                } else {
                                    if (addressComponent.types.indexOf("administrative_area_level_1") > -1) {
                                        gAreaLvl1 = addressComponent.long_name.trim();
                                        gAreaLvl1Short = addressComponent.short_name;
                                    } else {
                                        if (addressComponent.types.indexOf("administrative_area_level_2") > -1) {
                                            gAreaLvl2 = addressComponent.long_name.trim();
                                        } else {
                                            if (addressComponent.types.indexOf("country") > -1) {
                                                gCountry = addressComponent.short_name;
                                            } else {
                                                if (addressComponent.types.indexOf("postal_town") > -1) {
                                                    gPostalTown = addressComponent.long_name.trim();
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                /**
                 * For each input, we check
                 *  - if the value from Google is ok
                 *  - that the input field is present (can be suggest edit on one field)
                 *  - that the new value isn't the same as the old one
                 */

                if (addressFormFields.address.length) {
                    if ('' !== gRoute) {
                        var formattedAddress = data.results[0].formatted_address;
                        var formattedAddressClean = gRoute.trim();
                        if (gStreeNumber !== "") {
                            if (formattedAddress.indexOf(gRoute) > formattedAddress.indexOf(gStreeNumber)) {
                                formattedAddressClean = gStreeNumber + " " + formattedAddressClean.lowercaseFirstLetter();
                            } else {
                                formattedAddressClean += " " + gStreeNumber;
                            }
                        }

                        formattedAddressClean = formattedAddressClean.convertCC();

                        if (formattedAddressClean !== addressFormFields.address.val()) {
                            addressUpdated = updateFields(addressFormFields.address, formattedAddressClean);
                        }
                    } else {
                        // in case of no address update, we try to convert "Centre Commercial" in "C.C"
                        var newAddress = addressFormFields.address.val().convertCC();
                        if (newAddress !== addressFormFields.address.val()) {
                            addressUpdated = updateFields(addressFormFields.address, newAddress);
                        }
                    }
                }

                if ('' !== gZip && addressFormFields.zip.length && gZip !== addressFormFields.zip.val()) {
                    addressUpdated = updateFields(addressFormFields.zip, gZip);
                }

                // custom update for this state
                // @see https://www.facebook.com/notes/foursquare-french-su/352769948167141
                if (gAreaLvl1 === 'Provence-Alpes-Côte d\'Azur') {
                    gAreaLvl1 = 'PACA';
                }

                if ('' !== gAreaLvl1 && addressFormFields.state.length && gAreaLvl1 !== addressFormFields.state.val()) {
                    addressUpdated = updateFields(addressFormFields.state, gAreaLvl1);
                }

                if (gPostalTown !== "") {
                    gLocality = gPostalTown;
                }

                if ('' !== gLocality && addressFormFields.city.length) {
                    // convert city from "Boulou (Le)" to "Le Boulou"
                    var regExp = /\(([^)]+)\)/;
                    var matches = regExp.exec(gLocality);
                    if (matches && matches[1]) {
                        gLocality = (matches[1]+' '+gLocality.replace('('+matches[1]+')', '')).trim();
                    }

                    if (gLocality !== addressFormFields.city.val()) {
                        addressUpdated = updateFields(addressFormFields.city, gLocality);
                    }
                }

                // update location on suggest edit
                if (typeof addressFormFields.location !== "undefined") {
                    addressUpdated = updateFields(addressFormFields.location, gLocality);
                }

                if (addressFormFields.name.val()) {
                    // convert "Centre Commercial" in "C.C"
                    var newName = addressFormFields.name.val().convertCC();
                    if (newName !== addressFormFields.name.val()) {
                        addressUpdated = updateFields(addressFormFields.name, newName);
                    }

                    // try to update known company: twitter & url
                    $.map(companies, function (element, index) {
                        var regexCompany = new RegExp(index, "gi");
                        if (regexCompany.exec(addressFormFields.name.val())) {
                            var companyFound = companies[index];

                            if (companyFound.twitter !== addressFormFields.twitter.val()) {
                                addressUpdated = updateFields(addressFormFields.twitter, companyFound.twitter);
                            }

                            if (companyFound.url !== addressFormFields.url.val()) {
                                addressUpdated = updateFields(addressFormFields.url, companyFound.url);
                            }

                            return;
                        }
                    });
                }

                loadingImg.hide();

                if (true === addressUpdated) {
                    bindAddressRollBack(addressFormFields);

                    // do notify about many results only in case that address has beed updated
                    if (data.results.length > 1) {
                        $(insertMessageAfter).append('<span class="su-powertools-message-warning">The result may be inaccurate, please check the data.</span>');
                    }

                    foursquareNotifier.info('Address updated !');
                } else {
                    foursquareNotifier.info('Nothing to update');
                }
            },
            statusCode: {
                0: function () {
                    $(insertMessageAfter).append('<span class="su-powertools-message-error">Google Maps API connector is not available, please try again later.</span>');
                    loadingImg.hide();
                },
                403: function () {
                    $(insertMessageAfter).append('<span class="su-powertools-message-error">Permission denied using Google Maps API, please try again later.</span>');
                    loadingImg.hide();
                },
                404: function () {
                    $(insertMessageAfter).append('<span class="su-powertools-message-error">Google Maps API connector not found, please try again later.</span>');
                    loadingImg.hide();
                },
                500: function () {
                    $(insertMessageAfter).append('<span class="su-powertools-message-error">Google Maps API internal error, please try again later.</span>');
                    loadingImg.hide();
                }
            }
        });
    }

    /**
     * Display a link "Tick all suggested detail" (in /edit/details) to mark all suggested detail to valid
     * Then, it will flip to be able to untick all suggested detail
     */
    function displaySelectAllWoe() {
        var woeSets = $('ul.woeSets');

        // avoid duplicate enhancement
        if ($('#su-powertools-woesets').html() || !woeSets.html()) {
            return;
        }

        woeSets.prepend('<p id="su-powertools-woesets"><a href="#" class="tick">Tick all suggested details</a></p>');

        $('#su-powertools-woesets a').bind('click', function tickAllDetails() {
            var link = $(this);

            if (link.hasClass('tick')) {
                $('li.woe.unselected').each(function () {
                    $(this)
                        .removeClass('unselected')
                        .addClass('selected');
                });

                link.html('Untick all suggested details')
                    .removeClass('tick')
                    .addClass('untick');
            } else {
                $('li.woe.selected').each(function () {
                    $(this)
                        .removeClass('selected')
                        .addClass('unselected');
                });

                link.html('Tick all suggested details')
                    .removeClass('untick')
                    .addClass('tick');
            }

            // it's coming from a link, so we cancel the href '#'
            return false;
        });
    }

    // be sure that every new venue will be updated
    setInterval(function () {
        initializeEnhanceBlock();
        enhanceSearch();
        displayEmptyValue();
        displayFlagOptions();
        displayFixAddress();
        enhanceSearchSuggestEdit();
        displayFixAddressSuggestEdit();
        displaySelectAllWoe();
    }, 500);

    initialize();

    /**
     * Check that we are on the dashboard
     * (be sure to check if user is on /edit and /edit/)
     * If so we add a user stats for all proposed suggestions / approved
     */
    if (null !== window.location.pathname.match(/^\/edit\/?$/)) {
        // Options to set the Google Maps API key - REQUIRED :)
        if (!foursquareStorage.exists('SPT-gmap-key')) {
            var optionsHtml = '' +
                '<div id="su-powertools-options">' +
                    '<h2>Thanks for installing SU Power Tools !</h2>' +
                    "<p><em>This message won't appear anymore after this step is completed.</em></p>"+
                    "<p>In order to use the Google Maps API to automatically fix address you need to provide a Google Maps API key. Don't worry, if you already have a Google Account, it will be a very easy step.</p>"+
                    '<p>Everything is clearly explain <a href="https://developers.google.com/maps/documentation/javascript/tutorial#api_key" target="_blank">here</a>. Once you have your key, just past it in the input below. </p>' +
                    '<input type="text" id="gmaps_api_key">' +
                    '<button id="save">Save</button>' +
                '</div>';

            $('#container').prepend(optionsHtml);

            $('#su-powertools-options #save').bind('click', function handleOptionsSave() {
                var gmaps_api_key = $('input#gmaps_api_key').val();

                // Google Maps API key seems to be 39 char long, little restriction then...
                if (39 !== gmaps_api_key.length) {
                    alert('This API key seems invalid, please follow step from the Google documentation.');
                    $('input#gmaps_api_key').val('');
                    return false;
                }

                foursquareStorage.set('SPT-gmap-key', $('input#gmaps_api_key').val());
                $('#su-powertools-options').hide();
                foursquareNotifier.info('Perfect ! Your Google Maps API key is now saved. Enjoy SU Power Tools :)');
            });
        }

        fourSq.api.services.User.flagStats(
            window.fourSq.config.user.USER_PROFILE.id,
            function handleSuccess(response) {
                var processed = 0,
                    proposed = 0,
                    processedApproved = 0,
                    proposedApproved = 0;

                for (var i = response.stats.length - 1; i >= 0; i--) {
                    processed += response.stats[i].processed;
                    proposed += response.stats[i].proposed;
                    processedApproved += response.stats[i].processedApproved;
                    proposedApproved += response.stats[i].proposedApproved;
                }

                $('<div class="queueWrapper" id="su-powertools-stats"><h3>Your Stats</h3><ul class="queueLinks"></ul></div><br/><br/>').insertBefore('#su-tools-dash div.wideColumn div.queueWrapper');

                var allStatsList = $('#su-powertools-stats ul.queueLinks');

                var tpl = '' +
                '<li class="queueLinkItem">' +
                    '<a href="#" class="queueLink">' +
                        '<h3>%title%</h3>' +
                        '<div class="userInfo">' +
                            '<span class="userStats">' +
                                '<span class="approvedCount">%approvedCount%</span> / <span class="suggestedCount">%suggestedCount%</span>' +
                            '</span>' +
                            '<span class="pendingIndicator">' +
                                '<span class="pendingCount">%percentage%%</span>' +
                            '</span>' +
                        '</div>' +
                    '</a>' +
                '</li>';

                // append overall stats
                var percentage = proposedApproved/proposed*100;
                if (isNaN(percentage)) {
                    percentage = 0;
                }

                var statTpl = tpl
                    .replace('%title%', 'Overall stats', 'mi')
                    .replace('%approvedCount%', proposedApproved, 'mi')
                    .replace('%suggestedCount%', proposed, 'mi')
                    .replace('%percentage%', parseFloat(percentage).toFixed(2), 'mi');

                allStatsList.append(statTpl);

                var statsTitle = {
                    'attribute': 'Business details',
                    'tip': 'Flagged tips',
                    'category': 'Category suggestions',
                    'remove': 'Removal suggestions',
                    'info': 'Address suggestions',
                    'uncategorized': 'Suggest categories',
                    'duplicate': 'Merge suggestions',
                    'private': 'Places as private'
                };

                /**
                 * loop thru all stats, replace values from the tpl and append the line
                 *
                 * {
                 *    "proposed": 200,
                 *    "proposedApproved": 148,
                 *    "proposedPending": 0,
                 *    "processed": 23,
                 *    "processedApproved": 21,
                 *    "processedPending": 1,
                 *    "type": "private"
                 *  }
                 */
                for (var j = response.stats.length - 1; j >= 0; j--) {
                    var curentStat = response.stats[j];

                    if (!statsTitle[curentStat.type]) {
                        continue;
                    }

                    // calculate the percentage between suggested & approuved
                    percentage = curentStat.proposedApproved/curentStat.proposed*100;
                    if (isNaN(percentage)) {
                        percentage = 0;
                    }

                    statTpl = tpl
                        .replace('%title%', statsTitle[curentStat.type], 'mi')
                        .replace('%approvedCount%', curentStat.proposedApproved, 'mi')
                        .replace('%suggestedCount%', curentStat.proposed, 'mi')
                        .replace('%percentage%', parseFloat(percentage).toFixed(2), 'mi');

                    allStatsList.append(statTpl);
                }
            },
            function handleError(response) {
                foursquareNotifier.error('Error: ' + response.response.meta.errorDetail);
            }
        );
    }
})();
