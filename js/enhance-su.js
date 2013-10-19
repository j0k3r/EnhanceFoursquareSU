$(document).ready(function() {
    "use strict";
    var gmapsApi = '//maps.googleapis.com/maps/api/geocode/json';
    var oldAddressValues = {};

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
     * Display a link beside the "Edit this location" in edition panel
     * to automatically update address fields (address, state, zip & city) using Google Maps
     * It's displayed only when we have an address in the form.
     */
    function displayFixAddress () {
        // if edit panel doesn't exists or enhancement already exists
        if (!$('div.editPanes div.editPane').html() || $('#enhance-su-auto-address').html()) {
            return;
        }

        // if there is no address, we won't try to improve it automatically
        var address = $('li.field.simpleField[data-key="address"] input');
        if ($('div.editPanes div.editPane').html() && (address && '' === address.val())) {
            return;
        }

        $('div.editPanes div.editPane h3').append(' <span id="enhance-su-auto-address"><a href="#">Fix address</a> <img style="display: none" src="//i.imgur.com/Srmlo6N.gif" /></span>');

        // bind link
        $('#enhance-su-auto-address a').bind('click', function() {
            $('.enhance-su-message-error').remove();
            $('.enhance-su-message-warning').remove();

            var addressFields = {
                address: address,
                state: $('li.field.simpleField[data-key="state"] input'),
                zip: $('li.field.simpleField[data-key="zip"] input'),
                city: $('li.field.simpleField[data-key="city"] input')
            };

            setAddressFromGoogle(
                address.val(),
                addressFields.city.val(),
                addressFields,
                $(this).next('img'),
                'div.editPanes div.editPane h3'
            );

            return false;
        });
    }

    function displayFixAddressSuggestEdit () {
        // if edit panel doesn't exists or enhancement already exists
        if (!$('div.modalLoadingContainer div.inputArea').html() || $('#enhance-su-auto-address').html()) {
            return;
        }

        // if there is no address, we won't try to improve it automatically
        var address = $('input.formStyle.flagEditInput.address');
        var latlong = $('input.formStyle.flagEditInput.ll');
        if (address && '' === address.val() && latlong && '' === latlong.val()) {
            return;
        }

        $('<div id="enhance-su-auto-address"><a href="#">Fix address</a> <img style="display: none" src="//i.imgur.com/Srmlo6N.gif" /></div>').insertAfter('input.formStyle.venueNameInput.flagEditInput');

        // bind link
        $('#enhance-su-auto-address a').bind('click', function(event) {
            event.preventDefault();

            $('.enhance-su-message-error').remove();
            $('.enhance-su-message-warning').remove();

            var addressFields = {
                address: address,
                state: $('input.formStyle.flagEditInput.state'),
                zip: $('input.formStyle.flagEditInput.zip'),
                city: $('input.formStyle.flagEditInput.city')
            };

            // keep old value to be able to rollback
            if (jQuery.isEmptyObject(oldAddressValues)) {
                oldAddressValues = {
                    address: addressFields.address.val(),
                    state: addressFields.state.val(),
                    zip: addressFields.zip.val(),
                    city: addressFields.city.val()
                };
            }

            // use lat & long if we don't have an address
            var addressSearchQuery = address.val();
            var city = addressFields.city.val();
            if ('' === addressSearchQuery) {
                addressSearchQuery = latlong.val();
                city = '';
            }

            setAddressFromGoogle(
                addressSearchQuery,
                city,
                addressFields,
                $(this).next('img'),
                '#enhance-su-auto-address'
            );

            if (!$('#enhance-su-auto-address-rollback').html()) {
                $('<span> - </span><a href="#" id="enhance-su-auto-address-rollback">rollback change</a>').insertAfter('#enhance-su-auto-address a');

                $('#enhance-su-auto-address-rollback').bind('click', {addressFormFields: addressFields}, function(event) {
                    // clean message since we rollback
                    $('.enhance-su-message-error').remove();
                    $('.enhance-su-message-warning').remove();

                    event.data.addressFormFields.address.val(oldAddressValues.address);
                    event.data.addressFormFields.address.css('color', '#4d4d4d');

                    event.data.addressFormFields.zip.val(oldAddressValues.zip);
                    event.data.addressFormFields.zip.css('color', '#4d4d4d');

                    event.data.addressFormFields.state.val(oldAddressValues.state);
                    event.data.addressFormFields.state.css('color', '#4d4d4d');

                    event.data.addressFormFields.city.val(oldAddressValues.city);
                    event.data.addressFormFields.city.css('color', '#4d4d4d');

                    // rollback is done, remove link and reset old values
                    $(this).prev('span').remove();
                    $(this).remove();
                    oldAddressValues = {};
                });
            }

            return false;
        });
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
        loadingImg.show();

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

                if (data.results.length > 1) {
                    $(insertMessageAfter).append('<span class="enhance-su-message-warning">The result may be inaccurate, please check the data and correct if necessary.</span>');
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

                if (gRoute !== "") {
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
                    }
                }

                if (gPostalTown !== "") {
                    gLocality = gPostalTown;
                }

                if (gZip !== addressFormFields.zip.val()) {
                    addressFormFields.zip.val(gZip).change();
                    addressFormFields.zip.css('color', 'limegreen');
                }

                if (gAreaLvl1 !== "" && gAreaLvl1 !== addressFormFields.state.val()) {
                    addressFormFields.state.val(gAreaLvl1).change();
                    addressFormFields.state.css('color', 'limegreen');
                }

                if (gLocality !== addressFormFields.city.val()) {
                    addressFormFields.city.val(gLocality).change();
                    addressFormFields.city.css('color', 'limegreen');
                }

                loadingImg.hide();
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
        displayFixAddressSuggestEdit();
    }, 500);
});
