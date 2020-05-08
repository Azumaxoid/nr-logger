const express = require('express')
    , app = express()
    , axios = require('axios')

app.use(express.json({ extended: true, limit: '512mb' }))
app.use(express.urlencoded({ extended: true }));

const NR_INSERT_KEY=process.env.NR_INSERT_KEY;
const PAYLOAD_SIZE=20;
app.post('/nrlogs', function (req, res) {
    var events = req.body;
        //timestamp: (new Date(event.LogDate)).getTime(),
    var logEvents = events.map(event => ({
        timestamp: (new Date()).getTime(),
        message: JSON.stringify(event),
        attributes: event
    }));
    console.log(`Number of events :${logEvents.length}`);
    var p = new Promise(r=>{r()});
    for (var i=0; i < logEvents.length; i+=PAYLOAD_SIZE) {
      const start = i;
      p=p.then( new Promise(r=>{
        console.log(`Start upload from ${start}`);
         var payload = [{
          "common": {
            "attributes": {
              "logtype": "trendmicro"
            }
          },
          "logs": logEvents.slice(start, start+PAYLOAD_SIZE)
        }];
        axios.post('https://log-api.newrelic.com/log/v1', payload, {
            headers : {
                'Content-Type': 'application/json',
                'X-Insert-Key': NR_INSERT_KEY
            }
        }).catch((e)=>{console.error(e);});
      }));
    }
    p.then(()=>{ res.json({ status: "succeeded"});});
});

var server = app.listen(process.env.PORT || 8100, function () {
  var port = server.address().port;
  console.log("App now running in %s mode on port %d", app.get("env"), port);
});
