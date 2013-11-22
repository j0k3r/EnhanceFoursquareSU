# SU Power Tools

**Su Power Tools** is a very lightweight Chrome extension that makes some improvement to the Foursquare SU Tools.

## Enhancement

### Search links

  * Convert Bing.com link to Google.com (for "(search the web)")
  * Add a link to Google Maps
  * Move both link above the venue name

![](http://f.cl.ly/items/0D0O3S0X381G101B1R3q/search-1.png)

### Empty value from edit panel

  * Parse all empty value from edit panel and display them above the venue name.
    If there are more than 6 empty values, we don't list them

![](http://f.cl.ly/items/0Q1s2G0y0G3r1f2K1h3y/4%20empty%20fields.png)

![](http://f.cl.ly/items/3r2B1E2X0L223B2u242M/8%20empty%20fields.png)

### Ability to use Google Maps to automatically fix an address (in /edit)

  * call Google Maps API to fix address
  * let the user fixes change or cancel them

![](http://f.cl.ly/items/0a2F0Z0p092m2e1V333f/Capture%20d%E2%80%99%C3%A9cran%202013-10-13%20%C3%A0%2022.07.19.png)

![](http://f.cl.ly/items/1T1y351v3p361D3m3w1C/Capture%20d%E2%80%99%C3%A9cran%202013-10-13%20%C3%A0%2022.07.28.png)

### Ability to use Google Maps to automatically fix an address (in a suggest edit)

  * call Google Maps API to fix address
  * use latitude & longitude if there is no address
  * let the user fixes change or cancel them
  * ability to rollback change

![](http://f.cl.ly/items/2v3a1i1U0O0v0H2B3z2P/Capture%20d%E2%80%99%C3%A9cran%202013-10-19%20%C3%A0%2021.01.43.png)

![](http://f.cl.ly/items/1Z2j2z0j3o1x323W2S3A/Capture%20d%E2%80%99%C3%A9cran%202013-10-19%20%C3%A0%2021.01.53.png)

## How to use

* Install the Chrome extension (WIP...)
* Just go on [Superuser Tools page](https://foursquare.com/edit)
* Enjoy improvment :)

## How to install for dev

* Clone the project
* Open Tools > Extensions menu in Chrome
* Enable _developer mode_
* Click on _load the unpacked extension_
* Select the path to your local copy of **SUPowerTools**

## License

SU Power Tools is licensed under the [MIT license](LICENSE).
