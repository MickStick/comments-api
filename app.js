let createError = require('http-errors');
let express = require('express');
let path = require('path');
let cookieParser = require('cookie-parser');
let logger = require('morgan');
const hpp = require('hpp');
const helmet = require("helmet");

let indexRouter = require('./routes/index');
let commentRouterV1 = require('./routes/v1/comments/commentsApi');
let likesRouterV1 = require('./routes/v1/likes/likesApi');


let app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

//Setting up middleware
app.use(logger(process.env.LOG_LEVEL));
// app.use(express.urlencoded({ extended: true, limit: "1kb"}));
app.use(express.json({limit: "5kb"}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(hpp());
app.use(helmet()); // Add various HTTP headers
app.use(helmet.hidePoweredBy({ setTo: 'PHP 4.2.0' }));

app.use('/', indexRouter);
app.use('/api/v1/comment', commentRouterV1)
app.use('/api/v1/like', likesRouterV1)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
