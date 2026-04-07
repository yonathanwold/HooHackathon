const path = require('node:path');
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const lusca = require('lusca');
const morgan = require('morgan');

const aiController = require('./controllers/ai');
const bricksmithController = require('./controllers/bricksmith');

try {
  process.loadEnvFile('.env');
} catch (err) {
  if (err && err.code !== 'ENOENT') {
    console.error('Error loading .env file:', err);
  }
}
try {
  process.loadEnvFile('.env.example');
} catch (err) {
  if (err && err.code === 'ENOENT') {
    console.log('No .env.example file found. This is OK if required env vars are already set.');
  } else {
    console.error('Error loading .env.example file:', err);
  }
}

const app = express();

app.set('host', process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0');
app.set('port', process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(morgan('dev'));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET || 'dev_lego_secret',
    name: 'lego_builder',
    cookie: {
      maxAge: 1209600000,
      secure: false,
    },
  }),
);

app.use((req, res, next) => {
  if (req.path === '/ai/lego-builder') {
    return next();
  }
  return lusca.csrf()(req, res, next);
});

app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
app.disable('x-powered-by');

app.use('/', express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));

app.get('/', (req, res) => res.redirect('/ai/lego-builder'));
app.get('/ai/lego-builder', lusca({ csrf: true }), aiController.getLegoBuilder);
app.get('/ai/lego-builder/scan-parts', lusca({ csrf: true }), aiController.getLegoBuilderScanParts);
app.get('/ai/lego-builder/demo', lusca({ csrf: true }), aiController.getLegoBuilderDemo);
app.get('/ai/lego-builder/demo-tree', lusca({ csrf: true }), aiController.getLegoBuilderDemoTree);
app.get('/ai/lego-builder/demo-stack', lusca({ csrf: true }), aiController.getLegoBuilderDemoStack);
app.get('/ai/lego-builder/demo-1477', lusca({ csrf: true }), aiController.getLegoBuilderDemo1477);
app.get('/ai/lego-builder/demo-1477-live', lusca({ csrf: true }), aiController.getLegoBuilderDemo1477Live);
app.post('/ai/lego-builder', aiController.imageUploadMiddleware, lusca({ csrf: true }), aiController.postLegoBuilder);
app.get('/bricksmith', lusca({ csrf: true }), bricksmithController.getBricksmith);
app.post('/bricksmith/generate', lusca({ csrf: true }), bricksmithController.postGenerate);

app.use((req, res) => {
  res.status(404).send('Page Not Found');
});

app.use((err, req, res) => {
  console.error(err);
  res.status(500).send('Server Error');
});

app.listen(app.get('port'), () => {
  console.log(`App is running on http://localhost:${app.get('port')} in ${app.get('env')} mode.`);
  console.log('Press CTRL-C to stop.');
});

module.exports = app;
