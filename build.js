const ejs = require('ejs');
const fs = require('fs');

const templatePath = 'templates/layout.ejs';
const outputPath = 'index.html';

ejs.renderFile(templatePath, {}, {}, (err, str) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  fs.writeFileSync(outputPath, str);
  console.log(`Rendered ${outputPath}`);
});
