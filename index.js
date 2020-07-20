const express = require('express')
    , app = express()
    , axios = require('axios')
    , AWS = require('aws-sdk')

AWS.config.loadFromPath('./awsconfig.json');
var sns = new AWS.SNS({apiVersion: '2010-03-31'});

app.use(express.json({ extended: true, limit: '512mb' }))
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ extended: true, limit: '512mb' }));

const NR_INSERT_KEY=process.env.NR_INSERT_KEY;
const SNS_TOPIC=process.env.SNS_TOPIC;
const ENDPOINT=process.env.ENDPOINT;
const PAYLOAD_SIZE=20;

function initSubscriber(callback) {
    var args = {
        TopicArn: SNS_TOPIC,
	Protocol: 'http',
	Endpoint: ENDPOINT
    };
    console.log(args);
    sns.subscribe(args).promise().then((err, data) =>{
        console.log("subscribe start.");
        console.log(data);
        callback(null, 3);
    }).catch((err)=>{
      console.error(err, err.stack);
    });
}
initSubscriber(()=>{});
app.post('/nrlogs', function (req, res) {
    //initSubscriber(()=>{});
    var body = JSON.parse(req.body);
    console.log(req.headers);
    console.log(body);
    if (req.headers['x-amz-sns-message-type'] === 'SubscriptionConfirmation') {
        sns.confirmSubscription({
            TopicArn: req.headers['x-amz-sns-topic-arn'],
            Token : body.Token
        }, (err, r)=>{
            console.log(err);
            if(err){
                return reject(err)
            }
            return res.json();
        });
	return;
    }
    var events = body;
    if (!events.map) {
	console.log('Skip request');
	res.json({ status: "skipped" });
	return;
    }
        //timestamp: (new Date(event.LogDate)).getTime(),
    var logEvents = events.map(event => ({
        timestamp: (new Date(event.LogDate)).getTime(),
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
