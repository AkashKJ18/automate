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
console.log('hi');
console.log('hi');
console.log('hi');
console.log('hi');
console.log('hi');
console.log('hi');
console.log('hi');



app.post('/webhook', async (req, res) => {
  const event = req.headers['x-github-event'];
  const payload = req.body;

  if (event === 'pull_request' && payload.action === 'opened') {
    const { number: prNumber, base, head } = payload.pull_request;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

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

    const prompt = `You are a senior software engineer. Please review the following GitHub Pull Request diff:\n${diffRes.data}`;

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

    const review = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;

    // Post review as PR comment
    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { body: `🤖 AI Review:\n\n${review}` },
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );

    res.sendStatus(200);
  } else {
    res.sendStatus(200);
  }
});

app.listen(8000, () => console.log('Listening on port 8000'));
