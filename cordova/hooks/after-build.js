const { execSync } = require('child_process');

function androidAfterBuild() {
  console.log('Running Android after build hook...');

  console.log('Installing "cordova-plugin-apkupdater@4.0.0" needed by Android app');
  execSync('cordova plugin remove cordova-plugin-apkupdater@4.0.0');
}

module.exports = function(context) {
  switch (context.opts.platforms[0]) {
    case 'android': return androidAfterBuild();
  }
}
