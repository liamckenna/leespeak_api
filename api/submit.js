import { Octokit } from "octokit";

const repo = "liamckenna/LEE_SPEAK";
const branch = "master";
const filepath = "data/comments.json";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, comment, slug, path } = req.body;

  if (!name || !comment || !slug || !path) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const { data: file } = await octokit.rest.repos.getContent({
      owner: "liamckenna",
      repo: "LEE_SPEAK",
      path: filepath,
      ref: branch,
    });

    const content = Buffer.from(file.content, "base64").toString();
    const json = JSON.parse(content);

    if (!json[path]) json[path] = {};
    if (!json[path][slug]) json[path][slug] = [];

    json[path][slug].push({
      name,
      comment,
      date: new Date().toISOString(),
    });

    const updatedContent = Buffer.from(JSON.stringify(json, null, 2)).toString("base64");

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: "liamckenna",
      repo: "LEE_SPEAK",
      path: filepath,
      message: `Add comment to ${path}/${slug}`,
      content: updatedContent,
      sha: file.sha,
      branch,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error saving comment:", err);
    return res.status(500).json({ error: "Failed to save comment" });
  }
}
