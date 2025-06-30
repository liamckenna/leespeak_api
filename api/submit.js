import { Octokit } from "octokit";

const owner = "liamckenna";
const repo = "LEE_SPEAK";
const branch = "master";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, comment, slug, path } = req.body;

  if (!name || !comment || !slug || !path) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const filepath = `data/comments/${path}/${slug}.json`;

  let file;
  let json = [];

  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filepath,
      ref: branch,
    });

    file = response.data;
    const content = Buffer.from(file.content, "base64").toString();
    json = JSON.parse(content);
  } catch (err) {
    if (err.status === 404) {
      file = null;
      json = [];
    } else {
      console.error("Error reading existing file:", err);
      return res.status(500).json({ error: "Failed to read comment file" });
    }
  }

  json.push({
    name,
    comment,
    date: new Date().toISOString(),
  });

  const updatedContent = Buffer.from(JSON.stringify(json, null, 2)).toString("base64");

  try {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filepath,
      message: `Add comment to ${path}/${slug}`,
      content: updatedContent,
      sha: file?.sha,
      branch,
    });

    // Bump comment version to force rebuild
    await bumpCommentVersion();

    const redirectUrl = `https://leespeak.me/${path}/${slug}`;
    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error("Error writing comment:", err);
    return res.status(500).json({ error: "Failed to save comment" });
  }
}

async function bumpCommentVersion() {
  const triggerPath = "content/trigger/comment-version.md";

  try {
    const { data: file } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: triggerPath,
      ref: branch,
    });

    const decoded = Buffer.from(file.content, "base64").toString("utf8");
    const bumped = decoded.replace(
      /comment_version:\s*(\d+)/,
      (_, n) => `comment_version: ${parseInt(n) + 1}`
    );

    const updated = Buffer.from(bumped).toString("base64");

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: triggerPath,
      message: "Bump comment_version to trigger rebuild",
      content: updated,
      sha: file.sha,
      branch,
    });
  } catch (err) {
    console.error("Failed to bump comment version:", err);
  }
}
