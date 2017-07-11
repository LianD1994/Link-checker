var fs = require('fs');
var webPage = require('webpage');
var system = require('system');
var args = system.args;

var jsonObj = {
    "url": null,
    "device": null,
    "status": null,
    "duration": null,
    "number": null,
    "slowest_duration": null,
    "slowest": null,
    "largest": null,
    "largest_size": null,
    "size": null,
    "error": [],
    "blocked": false
};

function runPhantom(candidate) {

    var start = null;

    var resources = [];
    var page = webPage.create();
    page.open(candidate);
    

    // On load started
    // Get the start time
    // Prints out message "load started"
    page.onLoadStarted = function () {

        if (!start) {
            start = new Date().getTime();
        }
    };


    // On resource requested
    // Creates a resouces[], array contains information for each resource
    page.onResourceRequested = function (requestData, networkRequest) {

        var now = new Date().getTime();

        resources[requestData.id] = {
            id: requestData.id-1,
            url: requestData.url,
            request: requestData,
            responses: {},
            duration: '-',
            times: {
                request: now
            },
            statusCode: '   ',
            error: '',
            timedout: false
        };

        if (!start || now < start) {
            start = now;
        }
    };


    // On resource received
    // Get the resource from resources array using response.id
    // Update the status code for resources
    // Calculate the duration for loading a resource 
    // Update the size for resources using response.bodysize
    page.onResourceReceived = function (response) {

        var now = new Date().getTime(),
            resource = resources[response.id];

        if (resource.statusCode === '   ') {
            resource.statusCode = response.status;
        }

        resource.responses[response.stage] = response;

        if (!resource.times[response.stage]) {
            resource.times[response.stage] = now;
            resource.duration = now - resource.times.request;
        }

        if (response.bodySize) {
            resource.size = response.bodySize;
        } else if (!resource.size) {
            response.headers.forEach(function (header) {

                if (header.name.toLowerCase() === 'content-length') {
                    resource.size = parseInt(header.value);
                }
            });
        }
    };


    // On resource error
    // Get resouce by using resourceError.id
    // update the error for a resource
    // Update the status code for a resource
    // If the error resource is the first resource, the website is blocked.
    // Set the blocked attribute in jsonObj to true
    page.onResourceError = function (resourceError) {

        var resource = resources[resourceError.id];

        resource.error = {
            'url': resourceError.url,
            'error_type': resourceError.errorString,
            'error_code': resourceError.errorCode
        }

        if (resource.statusCode !== 408) {
            resource.statusCode = 'err';
        }

        // If the first resource has error then the url is blocked
        if (resourceError.id === 1) {
            jsonObj.blocked = true;
        }
    };


    // On Resource timeout
    // Get resource by request.id
    // Update the status code for resource
    // If the first resouce timedout then the url is blocked, update the blocked attribute
    page.onResourceTimeout = function (request) {

        var resource = resources[request.id];

        resource.timedout = true;
        resource.statusCode = request.errorCode;

        // If the first resource timedout then the url is blocked
        if (request.id === 1) {
            jsonObj.blocked = true;
        }
    };


    // On load finished
    // prints out the message "load finished"
    // Take a screenshot of the webpage
    // Calculate the size, and duration for resources
    // Set the return jsonObj to the correct value
    // Export the result jsonObj from Phantom to Node
    page.onLoadFinished = function (status) {
        setTimeout(function(){
        // todo: name each screenshot differently

        /*var screenshot = candidate + '.png';
        console.log(screenshot);

        page.render('./screenshot/abc.png');
        ssCount++;*/

        var finish = new Date().getTime(),
            slowest, fastest, totalDuration = 0,
            largest, smallest, totalSize = 0,
            missingSize = false,
            elapsed = finish - start;

        resources.forEach(function (resource) {
            if (!resource.times.start) {
                resource.times.start = resource.times.end;
            }
            if (!slowest || resource.duration > slowest.duration) {
                slowest = resource;
            }
            if (!fastest || resource.duration < fastest.duration) {
                fastest = resource;
            }
            if (resource.duration !== '-') {
                totalDuration += resource.duration;
            }
            if (resource.size) {
                if (!largest || resource.size > largest.size) {
                    largest = resource;
                }
                if (!smallest || resource.size < smallest.size) {
                    smallest = resource;
                }
                totalSize += resource.size;
            } else {
                resource.size = '-';
                missingSize = true;
            }
        })


        jsonObj.status = status;
        jsonObj.url = candidate;
        jsonObj.duration = elapsed;// in ms
        jsonObj.number = resources.length - 1;
        jsonObj.slowest_duration = slowest.duration;// in ms
        jsonObj.slowest = slowest.url;
        if (largest !== null) {
            jsonObj.largest_size = largest.size;// in bytes
            jsonObj.largest = largest.url
        }
        jsonObj.size = totalSize;

        console.log("==================================================");
        resources.forEach(function (resource) {
            if (resource.error !== '') {
                jsonObj.error.push(resource.error);
            }

            console.log(
                pad(resource.id, 3) + '. ' +
                pad('Status ' + resource.statusCode, 3) +
                pad(resource.duration, 6) + 'ms; ' +
                pad(resource.size, 7) + 'b; ' +
                truncate(resource.url, 84)
            );
        });

        console.log("==================================================");
        console.log(JSON.stringify(jsonObj, null, 2));
        console.log("==================================================");
        console.log(" ");
                
        phantom.exit();

        }, 10000);
    };
    // End of load finished



    // set resource timeout to 8 seconds
    page.settings.resourceTimeout = 8000;
    // set device to "chrome"
    page.settings.userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36";

    jsonObj.device = "Chrome";

    console.log('');
    console.log('==================================================')
    console.log('loading page: ' + candidate);
}




// Functions for formating console logs
// ==================================================
var truncate = function (str, length) {
    length = length || 80;
    if (str.length <= length) {
        return str;
    }
    var half = length / 2;
    return str.substr(0, half - 2) + '...' + str.substr(str.length - half + 1);
},

    pad = function (str, length) {
        var padded = str.toString();
        if (padded.length > length) {
            return pad(padded, length * 2);
        }
        return repeat(' ', length - padded.length) + padded;
    },

    repeat = function (chr, length) {
        for (var str = '', l = 0; l < length; l++) {
            str += chr;
        }
        return str;
    };



if (args.length !== 2) {
  console.log('please enter the url in the format http://<yoururl>');
  phantom.exit();
} else {
  runPhantom(args[1]);
  loading();
}

// prints out loading... every 3 seconds until the page is loaded.
function loading() {
   console.log("loading...");
}
setInterval(loading, 2000);