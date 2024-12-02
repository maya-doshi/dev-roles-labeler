import { LabelerServer } from '@skyware/labeler';
import { Bot, Post } from '@skyware/bot';
import 'dotenv/config';
import { LabelType } from './type.js';
import chalk from 'chalk';

const server = new LabelerServer({
  did: process.env.LABELER_DID!,
  signingKey: process.env.SIGNING_KEY!,
});

server.start(4001, (error) => {
  if (error) {
    console.error('Failed to start server:', error);
  } else {
    console.log('Labeler server running on port 14831');
  }
});


const bot = new Bot();
await bot.login({
  identifier: process.env.LABELER_DID!,
  password: process.env.LABELER_PASSWORD!,
});

const availableLabels = new Map<string, LabelType>();

server
  .db
  .prepare('SELECT * FROM labels_definitions')
  .all()
  .forEach((row: any) => availableLabels
    .set(row.uri as string, row as LabelType));

const allTags = Array.from(availableLabels.values()).map((label) => label.slug);


bot.on('like', async ({ subject, user }) => {

  const handle = chalk.underline(user.handle);
  if (!(subject instanceof Post)) {
    console.log(chalk.cyan('[L] ' + handle + ' liked the labeler!'));
    return;
  }

  const label = availableLabels.get(subject.uri);
  if (!label) {
    console.log(chalk.magenta('[L] ' + handle + ' liked a random post! (thx)'));
    return;
  }

  if (label.delete_trigger) {
    let userLabels = server.db.prepare('SELECT * FROM labels WHERE uri = ?').all(user.did);
    console.log(chalk.red('[D] Deleting ' + handle + ' labels: ' + userLabels.map((label: any) => label.val)));

    server.createLabels({ uri: user.did }, { negate: [...allTags, 'clear'] });

    server.db.prepare('DELETE FROM labels WHERE uri = ?').run(user.did);
    return;
  }

  let alreadyHasLabel = server.db.prepare('SELECT * FROM labels WHERE src = ? AND uri = ?').all(user.did, label.uri)
  if (alreadyHasLabel.length) {
    console.log(chalk.yellow('[A] ' + handle + ' already has ' + label.name));
    return;
  }
  
  server.createLabel({ uri: user.did, val: label.slug });
  console.log(chalk.green('[N] Labeling ' + handle + ' with ' + label.name));
});

