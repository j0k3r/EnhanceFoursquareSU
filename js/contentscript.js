// dirty hack: http://stackoverflow.com/a/9517879/569101
var s = document.createElement('script');
s.src = chrome.extension.getURL("js/supowertools.js");
(document.head||document.documentElement).appendChild(s);
s.parentNode.removeChild(s);

// load companies from json
$.getJSON(chrome.extension.getURL("companies.json"), function (data) {
    localStorage.setItem('companies', JSON.stringify(data));
});
