import { PostView } from '@atproto/api/dist/client/types/app/bsky/feed/defs.js';
import { AtpAgent } from '@atproto/api';
import { LabelerServer } from '@skyware/labeler';
import 'dotenv/config';
import { LabelerCategory } from '../labelerCategory.js';


interface BskyPost  {
  cid: string
  uri: string
  record: PostView
}

async function findPostByUri(agent: AtpAgent, uri: string): Promise<BskyPost> {
  // @ts-ignore
  let posts =  await agent.getPosts({
    uris: [uri]
  })
  
  let post = posts.data.posts[0] as PostView;
  
  return {
    uri: post.uri,
    cid: post.cid,
  } as BskyPost
}

async function findPostByText(agent: AtpAgent, query: string) {
  // @ts-ignore
  let authorFeedResponse = await agent.getAuthorFeed({
    actor: process.env.DID!,
    limit: 100,
  });

  if (!authorFeedResponse.data.feed.length) {
    return null;
  }

  // @ts-ignore
  return authorFeedResponse.data.feed.find((post) => post.post.record.text.includes(query));
}

async function getPostCategory(agent: AtpAgent, server: LabelerServer, categoryEntry: LabelerCategory) {
  let authorFeedResponse = await findPostByText(agent, categoryEntry.description);

  if (authorFeedResponse !== null && authorFeedResponse !== undefined) {
    console.log('[C] Category Found: ' + categoryEntry.description);
    return {
      uri: authorFeedResponse.post.uri,
      cid: authorFeedResponse.post.cid,
    } as BskyPost;
  }

  console.log('[C] New Category: ' + categoryEntry.description);

  let newCategory = await agent.post({
    text: categoryEntry.description,
    createdAt: new Date().toISOString(),
  });

  if (categoryEntry.delete_trigger) {
    server.db.prepare('INSERT OR IGNORE INTO labels_definitions (name, slug, description, uri, delete_trigger) VALUES (?, ?, ?, ?, ?);')
      .run(categoryEntry.description, 'clear', categoryEntry.description, newCategory.uri, 1);
  }
  
  return newCategory as BskyPost;
}

async function createLabel(
  server: LabelerServer,
  agent: AtpAgent,
  tag: any,
  categoryPost: BskyPost,
  parent: BskyPost,
) {

  let labelText = tag.name + ' ->  ' + tag.description;

  let postLabel = await findPostByText(agent, labelText);

  if (postLabel) {
    // @ts-ignore
    console.log('[L] Label Found: ' + postLabel.post.record.text);
    return findPostByUri(agent, postLabel.post.uri)
  }
  
  console.log('[L] New Label: ' + tag.name);
  let post = await agent.post({
    text: tag.name + ' ->  ' + tag.description,
    createdAt: new Date().toISOString(),
    reply: {
      root: { uri: categoryPost.uri, cid: categoryPost.cid },
      parent: { uri: parent.uri, cid: parent.cid },
    },
  });
  server.db.prepare('INSERT INTO labels_definitions (name, slug, description, uri, delete_trigger) VALUES (?, ?, ?, ?, ?);').run(tag.name, tag.slug, tag.description, post.uri, 0);

  return post as BskyPost;
}

export { getPostCategory, createLabel };
