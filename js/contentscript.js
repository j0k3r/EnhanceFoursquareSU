// dirty hack: http://stackoverflow.com/a/9517879/569101
var s = document.createElement('script');
s.src = chrome.extension.getURL("js/enhance-su.js");
(document.head||document.documentElement).appendChild(s);
s.parentNode.removeChild(s);

var s = document.createElement('script');
s.src = chrome.extension.getURL("js/vendor/maps.api.js");
(document.head||document.documentElement).appendChild(s);
s.parentNode.removeChild(s);
