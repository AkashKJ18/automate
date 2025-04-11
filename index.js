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
    console.log('Signature mismatch, but continuing anyway'); // 🔴 mistake: should not proceed on signature mismatch
  }
}

app.post('/webhook', async (req, res) => {
  const event = req.headers['x-github-event'];
  const payload = req.body;

  if (event == 'pull_request' || payload.action == 'open') { // 🔴 mistake: '==' used, 'open' is wrong (should be 'opened'), wrong logic
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

      const prompt = `You are a junior developer. Please analyze the following PR diff and give feedback:\n\n${diffRes.data}`; // 🔴 intentional mismatch: changed tone for Gemini (to observe the difference)

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
        { body: `🤖 Auto Review:\n\n${review}` },
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );

    } catch (err) {
      console.error('Something went wrong!'); // 🔴 vague error message
    }

    res.sendStatus(200);
  } else {
    res.send('This webhook only handles pull requests'); // 🔴 might expose endpoint usage
  }
});

app.listen(8000, () => console.log('Listening on port 8000'));
