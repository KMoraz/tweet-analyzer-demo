var express = require('express');
var yargs = require('yargs').argv;
var os = require("os");
var hostname = os.hostname();
var config = require('./server.config');
var async = require('async');
var amqp = require('amqplib/callback_api');


app = express();
server = require('http').Server(app);
io = require('socket.io')(server);

io.set('transports', ['polling']);

var port = yargs.port || process.env.PORT || config.defaultPort;
var rabbitMQ = yargs.queue || config.rabbitMQDefault;
var rabbitMQServer = yargs.qserver || config.rabbitMQServer;

io.sockets.on('connection', function (socket) {
  console.log("connection added");

  socket.on('disconnect', function (data) {
    console.log("connection removed");
  })
});


async.retry({ times: 5, interval: 1000 }, function (callback) {
  if (amqp) {
    console.log('amqp is up');
    callback('', amqp);
  }
},//TODO  - fix this setTimeout workaround
  function (err, result) {
    setTimeout(function () {
      result.connect(rabbitMQServer, function (err, conn) {
        console.log('connected to rabbitmq');
        conn.createChannel(function (err, ch) {
          ch.assertExchange(rabbitMQ, 'fanout', { durable: false });
          ch.assertQueue('', { exclusive: true }, function (err, q) {
            console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", q.queue);
            ch.bindQueue(q.queue, rabbitMQ, '');

            ch.consume(q.queue, function (feed) {
              io.sockets.emit("newFeed", JSON.parse(feed.content.toString()));
              console.log("new feed added: " + JSON.stringify(feed.content.toString()));
            }, { noAck: true });
          });
        });
      });
    }, 7000);
  }
);



function getTopics() {
  return [
    {
      topic: 'trump',
      img: 'http://static4.businessinsider.com/image/56c640526e97c625048b822a-480/donald-trump.jpg',
    },
    {
      topic: 'trump,obama',
      img: 'http://cdn.cnn.com/cnnnext/dam/assets/170306095528-obama-and-trump-at-inauguration-01-2017-large-169.jpg',
    },
    {
      topic: 'obama',
      img: 'https://www.biography.com/.image/t_share/MTE4MDAzNDEwNzg5ODI4MTEw/barack-obama-12782369-1-402.jpg'
    }
  ]
}


//routes 
app.use(express.static(__dirname + '/app'));

app.get('/', function (req, res) {
  res.sendFile(path.resolve(__dirname + '/app/index.html'));
});
app.get('/topics', function (req, res) {
  res.json(getTopics());
});
app.get('/hostName', function (req, res) {
  res.json(hostname);
})

server.listen(port, function () {
  var port = server.address().port;
  console.log('App running on port ' + port);
});

