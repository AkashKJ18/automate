require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json({ verify: verifySignature }));

function verifySignature(req, res, buf) {
  const signature = req.headers['x-hub-signature-256'];
  const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET);
  hmac.update(buf);
  const digest = `sha256=${hmac.digest('hex')}`;
  if (signature !== digest) {
    throw new Error('Invalid signature');
  }
}

app.post('/webhook', async (req, res) => {
  const event = req.headers['x-github-event'];
  const payload = req.body;

  if (event === 'pull_request' && payload.action === 'opened') {
    const { number: prNumber } = payload.pull_request;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    try {
      // Fetch PR diff
      const diffRes = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3.diff',
          },
        }
      );

      const prompt = `
You are a senior software engineer and expert code reviewer.

A developer has submitted the following code changes as a Pull Request. You are to act as a code reviewer and respond with detailed review with:

1. A short summary of what the code seems to do.
2. Critical issues (bugs, security flaws, logic errors).
3. Suggestions for improvement (performance, readability, naming, structure).
4. Inline comments with file and line numbers in this format:

[filename] Line X:
Your detailed comment explaining the issue or suggestion.

Do not summarize the whole diff in one sentence. Give feedback on specific code blocks where relevant.

Here is the full diff:
\`\`\`diff
${diffRes.data}
\`\`\`
`;


      // Send to Gemini
      const geminiRes = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        {
          contents: [{ parts: [{ text: prompt }] }],
        },
        {
          params: { key: process.env.GEMINI },
        }
      );

      console.log(JSON.stringify(geminiRes.data, null, 2));

      const review = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || '⚠️ No review content received from Gemini.';

      // Post review as PR comment
      await axios.post(
        `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
        { body: `🤖 **AI Review**\n\n${review}` },
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );

      res.sendStatus(200);
    } catch (err) {
      console.error('Error processing pull request:', err.message);
      res.status(500).send('Internal server error');
    }
  } else {
    res.sendStatus(200);
  }
});

app.listen(8000, () => console.log('🚀 Listening on port 8000'));
