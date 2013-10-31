(function () {
    "use strict";
    var gmapsApi = '//maps.googleapis.com/maps/api/geocode/json';
    var oldAddressValues = {};

    var _foursquareNotifier;
    var _foursquareApiVenue;

    /**
     * Some initilizations at first
     */
    function initialize () {
        // initialize the Foursquare notifier
        if (typeof _foursquareNotifier === "undefined") {
            _foursquareNotifier = fourSq.ui.Notifier.getInstance();
        }

        // initialize the Foursquare Venue API
        if (typeof _foursquareApiVenue === "undefined") {
            _foursquareApiVenue = fourSq.api.services.Venue;
        }
    }

    /**
     * Set first letter to lower case.
     * Used for route name
     *
     * @from http://stackoverflow.com/a/1026087/569101
     */
    function lowercaseFirstLetter(string) {
        return string.charAt(0).toLowerCase() + string.slice(1);
    }

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

        // remove crossStreet from address to get more accurate results
        var address = $('div.venueInfoText p.addressArea').html();
        var crossStreet = $('li.field.simpleField[data-key="crossStreet"] input').val();
        if ('' !== crossStreet) {
            address = address.replace(' ('+crossStreet+')', '');
        }

        var hrefMaps = 'https://maps.google.com/maps?q=' +
            encodeURIComponent($('h4 a.venue').html()) + ' ' +
            encodeURIComponent(address);

        var searchMaps = '<a target="_blank" href="' + hrefMaps + '">Google Maps</a>';

        $('#enhance-su-block').append('<span id="enhance-su-search">Search on: ' + searchGoogle + ' - ' + searchMaps + '</span>');
    }

    /**
     * Add search links to Google & Google Maps in the "suggest edit" panel
     */
    function enhanceSearchSuggestEdit () {
        // avoid duplicate enhancement
        if ($('#enhance-su-auto-address').html()) {
            return;
        }

        $('<div class="suggest-edit" id="enhance-su-auto-address"></div>').insertAfter('input.formStyle.venueNameInput.flagEditInput');

        // add Google link
        var hrefGoogle = 'https://www.google.com/search?q='+
            encodeURIComponent($('input.formStyle.venueNameInput.flagEditInput').val())+' '+
            encodeURIComponent($('input.formStyle.flagEditInput.city').val());

        $('#enhance-su-auto-address').append('Search on: <a target="_blank" href="'+hrefGoogle+'">Google</a>');

        // add Google Maps link
        var hrefMaps = 'https://maps.google.com/maps?q='+
            encodeURIComponent($('div.accordianHeader.expandable div.headerVenueText').html());

        $('#enhance-su-auto-address').append(' - <a target="_blank" href="'+hrefMaps+'">Google Maps</a>');
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

    /**
     * Display a link below the "Edit this location" in edition panel
     * to automatically update address fields (address, state, zip & city) using Google Maps
     * It's displayed only when we have an address in the form.
     */
    function displayFixAddress () {
        var editPane = $('div.editPanes div.editPane');

        // if edit panel doesn't exists or enhancement already exists
        if (!editPane.html() || $('#enhance-su-auto-address a.fix-address').html()) {
            return;
        }

        // since this function is used in an ajax environment, we need to ensure that oldAddressValues
        // is empty after the first enhancement
        oldAddressValues = {};

        $('div.editPanes div.editPane h3').append('<div id="enhance-su-auto-address"><a class="fix-address" href="#">Fix address</a> <img style="display: none" src="//i.imgur.com/Srmlo6N.gif" /></div>');

        var addressFields = {
            address: $('li.field.simpleField[data-key="address"] input'),
            state: $('li.field.simpleField[data-key="state"] input'),
            zip: $('li.field.simpleField[data-key="zip"] input'),
            city: $('li.field.simpleField[data-key="city"] input')
        };

        // if there is no address, we request the foursquare api to get lat/long values
        if (editPane.html() && (addressFields.address && '' === addressFields.address.val())) {
            _foursquareApiVenue.detail(
                editPane.data('venueid'),
                function (venue) {
                    doBindFixAddress(
                        addressFields,
                        'div.editPanes div.editPane h3',
                        venue.location.lat+','+venue.location.lng
                    );
                }
            );
        } else {
            doBindFixAddress(addressFields, 'div.editPanes div.editPane h3', '');
        }
    }

    /**
     * Bind the link to fix address in /edit
     *
     * @param  object   addressFields
     * @param  string   insertMessageAfter  @see setAddressFromGoogle
     * @param  string   latlong             If defined, it will be used instead of address/city
     */
    function doBindFixAddress (addressFields, insertMessageAfter, latlong) {
        $('#enhance-su-auto-address a.fix-address').bind('click', function() {
            // use lat & long if it is given
            var addressSearchQuery = addressFields.address.val();
            var city = addressFields.city.val();

            if (latlong !== '') {
                addressSearchQuery = latlong;
                city = '';
            }

            setAddressFromGoogle(
                addressSearchQuery,
                city,
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
    function displayFixAddressSuggestEdit () {
        // if edit panel doesn't exists or enhancement link already exists
        if (!$('div.modalLoadingContainer div.inputArea').html() || $('#enhance-su-auto-address a.fix-address').html()) {
            return;
        }

        // if there is no address, we won't try to improve it automatically
        var address = $('input.formStyle.flagEditInput.address').val();
        var latlong = $('input.formStyle.flagEditInput.ll').val();
        if ('' === address && '' === latlong) {
            return;
        }

        $('#enhance-su-auto-address').append('<br/>Or <a class="fix-address" href="#">fix the address</a> <img style="display: none" src="//i.imgur.com/Srmlo6N.gif" />');

        var addressFields = {
            address: $('input.formStyle.flagEditInput.address'),
            state: $('input.formStyle.flagEditInput.state'),
            zip: $('input.formStyle.flagEditInput.zip'),
            city: $('input.formStyle.flagEditInput.city')
        };

        // address exists? Do not use lat/lng to fix the address
        if ('' !== address) {
            latlong = '';
        }

        // bind link
        doBindFixAddress(addressFields, '#enhance-su-auto-address', latlong);
    }

    /**
     * Bind the rollback link
     *
     * @param  object addressFields
     */
    function bindAddressRollBack (addressFields) {
        // once the rollback is display, we won't reload it
        if ($('#enhance-su-auto-address-rollback').html()) {
            return;
        }

        $('<span> - </span><a href="#" id="enhance-su-auto-address-rollback">rollback change</a>').insertAfter('#enhance-su-auto-address a.fix-address');

        // handle cancel button click (and closing button - on the top right)
        // Foursquare will already re-apply old values, we just need to remove rollback link
        // and re-apply default color
        $('div.buttons span.cancelEditButton, div.editPane span.xButton').bind(
            'click',
            {addressFormFields: addressFields},
            function(event) {
                $('.enhance-su-message-error').remove();
                $('.enhance-su-message-warning').remove();

                event.data.addressFormFields.address.css('color', '#4d4d4d');
                event.data.addressFormFields.zip.css('color', '#4d4d4d');
                event.data.addressFormFields.state.css('color', '#4d4d4d');
                event.data.addressFormFields.city.css('color', '#4d4d4d');

                var rollbackBlock = $('#enhance-su-auto-address-rollback');
                rollbackBlock.prev('span').remove();
                rollbackBlock.remove();

                oldAddressValues = {};
            }
        );

        $('#enhance-su-auto-address-rollback').bind(
            'click',
            {addressFormFields: addressFields},
            function(event) {
                doAddressRollback(this, event.data.addressFormFields);

                // it's coming from a link, so we cancel the href '#'
                return false;
            }
        );
    }

    /**
     * It actually DO the rollback only
     */
    function doAddressRollback (element, addressFields) {
        // clean message since we rollback
        $('.enhance-su-message-error').remove();
        $('.enhance-su-message-warning').remove();

        addressFields.address.val(oldAddressValues.address);
        addressFields.address.css('color', '#4d4d4d');

        addressFields.zip.val(oldAddressValues.zip);
        addressFields.zip.css('color', '#4d4d4d');

        addressFields.state.val(oldAddressValues.state);
        addressFields.state.css('color', '#4d4d4d');

        addressFields.city.val(oldAddressValues.city);
        addressFields.city.css('color', '#4d4d4d');

        // rollback is done, remove link and reset old values
        $(element).prev('span').remove();
        $(element).remove();
        oldAddressValues = {};
    }

    /**
     * Took an address and (optionnaly) a city and update form address with Google results
     *
     * @param  string  address
     * @param  string  city
     * @param  object  addressFormFields    Fields from the form
     * @param  element loadingImg           Element to show/hide for interactivity
     */
    function setAddressFromGoogle (address, city, addressFormFields, loadingImg, insertMessageAfter) {
        $('.enhance-su-message-error').remove();
        $('.enhance-su-message-warning').remove();

        loadingImg.show();

        // keep old value to be able to rollback
        if (jQuery.isEmptyObject(oldAddressValues)) {
            oldAddressValues = {
                address: addressFormFields.address.val(),
                state: addressFormFields.state.val(),
                zip: addressFormFields.zip.val(),
                city: addressFormFields.city.val()
            };
        }

        // will be set to true if one element of the address is updated
        // it will allow us to add a rollback link in that case
        var addressUpdated = false;

        // don't add city if it's not provided
        // could make bad result if it's combined with lat/long
        var dataUrl = "sensor=false&address=" + encodeURIComponent(address);
        if ('' !== city) {
            dataUrl += "," + encodeURIComponent(city);
        }

        $.ajax({
            type: "GET",
            url: gmapsApi,
            data: dataUrl,
            dataType: "json",
            success: function (data, textStatus, jqXHR) {
                if (data.status !== "OK") {
                    loadingImg.hide();
                    return;
                }

                var gRoute = "";
                var gStreeNumber = "";
                var gLocality = "";
                var gPostalTown = "";
                var gAreaLvl1 = "";
                var gAreaLvl1Short = "";
                var gAreaLvl2 = "";
                var gZip = "";
                var gCountry = "";

                // empty result ? Do nothing.
                if (data.results.length <= 0) {
                    loadingImg.hide();
                    return;
                }

                for (var i = 0; i < data.results[0].address_components.length; i++) {
                    var addressComponent = data.results[0].address_components[i];
                    if (addressComponent.types.indexOf("route") > -1) {
                        gRoute = addressComponent.long_name;
                    } else {
                        if (addressComponent.types.indexOf("street_number") > -1) {
                            gStreeNumber = addressComponent.long_name;
                        } else {
                            if (addressComponent.types.indexOf("locality") > -1) {
                                gLocality = addressComponent.long_name;
                            } else {
                                if (addressComponent.types.indexOf("postal_code") > -1) {
                                    gZip = addressComponent.long_name;
                                } else {
                                    if (addressComponent.types.indexOf("administrative_area_level_1") > -1) {
                                        gAreaLvl1 = addressComponent.long_name;
                                        gAreaLvl1Short = addressComponent.short_name;
                                    } else {
                                        if (addressComponent.types.indexOf("administrative_area_level_2") > -1) {
                                            gAreaLvl2 = addressComponent.long_name;
                                        } else {
                                            if (addressComponent.types.indexOf("country") > -1) {
                                                gCountry = addressComponent.short_name;
                                            } else {
                                                if (addressComponent.types.indexOf("postal_town") > -1) {
                                                    gPostalTown = addressComponent.long_name;
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

                if ('' !== gRoute && addressFormFields.address.length) {
                    var formattedAddress = data.results[0].formatted_address;
                    var formattedAddressClean = gRoute.trim();
                    if (gStreeNumber !== "") {
                        if (formattedAddress.indexOf(gRoute) > formattedAddress.indexOf(gStreeNumber)) {
                            formattedAddressClean = gStreeNumber + " " + lowercaseFirstLetter(formattedAddressClean);
                        } else {
                            formattedAddressClean += " " + gStreeNumber;
                        }
                    }

                    if (formattedAddressClean !== addressFormFields.address.val()) {
                        addressFormFields.address.val(formattedAddressClean).change();
                        addressFormFields.address.css('color', 'limegreen');

                        addressUpdated = true;
                    }
                }

                if ('' !== gZip && addressFormFields.zip.length && gZip !== addressFormFields.zip.val()) {
                    addressFormFields.zip.val(gZip).change();
                    addressFormFields.zip.css('color', 'limegreen');

                    addressUpdated = true;
                }

                // custom update for this state
                // @see https://www.facebook.com/notes/foursquare-french-su/r%C3%A8gles-conseils/352769948167141
                if (gAreaLvl1 === 'Provence-Alpes-Côte d\'Azur') {
                    gAreaLvl1 = 'PACA';
                }

                if ('' !== gAreaLvl1 && addressFormFields.state.length && gAreaLvl1 !== addressFormFields.state.val()) {
                    addressFormFields.state.val(gAreaLvl1).change();
                    addressFormFields.state.css('color', 'limegreen');

                    addressUpdated = true;
                }

                if (gPostalTown !== "") {
                    gLocality = gPostalTown;
                }

                if ('' !== gLocality && addressFormFields.city.length && gLocality !== addressFormFields.city.val()) {
                    addressFormFields.city.val(gLocality).change();
                    addressFormFields.city.css('color', 'limegreen');

                    addressUpdated = true;
                }

                loadingImg.hide();

                if (true === addressUpdated) {
                    bindAddressRollBack(addressFormFields);

                    // do notify about many results only in case that address has beed updated
                    if (data.results.length > 1) {
                        $(insertMessageAfter).append('<span class="enhance-su-message-warning">The result may be inaccurate, please check the data.</span>');
                    }

                    _foursquareNotifier.info('Address updated !');
                } else {
                    _foursquareNotifier.info('Nothing to update');
                }
            },
            statusCode: {
                0: function () {
                    $(insertMessageAfter).append('<span class="enhance-su-message-error">Google Maps API connector is not available, please try again later.</span>');
                    loadingImg.hide();
                },
                403: function () {
                    $(insertMessageAfter).append('<span class="enhance-su-message-error">Permission denied using Google Maps API, please try again later.</span>');
                    loadingImg.hide();
                },
                404: function () {
                    $(insertMessageAfter).append('<span class="enhance-su-message-error">Google Maps API connector not found, please try again later.</span>');
                    loadingImg.hide();
                },
                500: function () {
                    $(insertMessageAfter).append('<span class="enhance-su-message-error">Google Maps API internal error, please try again later.</span>');
                    loadingImg.hide();
                }
            }
        });
    }

    // be sure that every new venue will be updated
    setInterval(function() {
        initializeEnhanceBlock();
        enhanceSearch();
        displayEmptyValue();
        displayFixAddress();
        enhanceSearchSuggestEdit();
        displayFixAddressSuggestEdit();
    }, 500);

    initialize();
})();
