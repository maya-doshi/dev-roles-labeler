import { LabelerServer } from '@skyware/labeler';
import { AtpAgent, ComAtprotoLabelDefs } from '@atproto/api';
import { tags } from './labelerCategory.js';
import 'dotenv/config';
import { setLabelerLabelDefinitions } from '@skyware/labeler/scripts';
import { createLabel, getPostCategory } from './utils/setup-utils.js';

const server = new LabelerServer({
  did: process.env.LABELER_DID!,
  signingKey: process.env.SIGNING_KEY!,
});

const prepareDatabase = async (server: LabelerServer) => {//
  server.db.prepare(
    'CREATE TABLE IF NOT EXISTS labels_definitions (name TEXT, slug TEXT PRIMARY KEY, description TEXT, uri TEXT, delete_trigger BOOLEAN);',
  ).run();

  const agent = new AtpAgent({
    service: 'https://bsky.social',
  });

  const loginCredentials = {
    identifier: process.env.DID!,
    password: process.env.BSKY_PASSWORD!,
  };

  await agent.login(loginCredentials);

  const labelDefinitions: ComAtprotoLabelDefs.LabelValueDefinition[] = [];

  for (const [_id, categoryEntry] of Object.entries(tags)) {

    let categoryPost = await getPostCategory(agent, server, categoryEntry);
    
    let parent = categoryPost;

    for (const tag of categoryEntry.values) {
      
      let post = await createLabel(server, agent, tag, categoryPost, parent);

      const labelValueDefinition: ComAtprotoLabelDefs.LabelValueDefinition = {
        identifier: tag.slug,
        severity: 'inform',
        blurs: 'none',
        defaultSetting: 'warn',
        adultOnly: false,
        locales: [
          {
            lang: 'en',
            name: tag.name,
            description: tag.description,
          },
        ],
      };

      labelDefinitions.push(labelValueDefinition);

      parent = post
    }
  }

  await setLabelerLabelDefinitions(loginCredentials, labelDefinitions);
};

await prepareDatabase(server);
