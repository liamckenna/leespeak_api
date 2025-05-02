import { Octokit } from "octokit";

const repo = "liamckenna/LEE_SPEAK";
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
    const res = await octokit.rest.repos.getContent({
      owner: "liamckenna",
      repo,
      path: filepath,
      ref: branch,
    });

    file = res.data;
    const content = Buffer.from(file.content, "base64").toString();
    json = JSON.parse(content);
  } catch (err) {
    if (err.status === 404) {
      // File doesn't exist yet — start fresh
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
      owner: "liamckenna",
      repo,
      path: filepath,
      message: `Add comment to ${path}/${slug}`,
      content: updatedContent,
      sha: file?.sha,
      branch,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error writing comment:", err);
    return res.status(500).json({ error: "Failed to save comment" });
  }
}
