const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  console.log(req);
  const token = req.headers['x-gitlab-token'];
  if (token !== process.env.ENV) {
    return res.status(403).send('Invalid token');
  }

  const { object_attributes, project } = req.body;
  if (object_attributes.state !== 'opened') return res.sendStatus(200);

  const mrIid = object_attributes.iid;

  // Fetch MR changes
  const changes = await axios.get(
    `http://repo.axxsoln.in/api/v4/projects/48/merge_requests/${mrIid}/changes`,
    { headers: { 'PRIVATE-TOKEN': process.env.SECRET } }
  );

  const diff = changes.data.changes.map(c => `File: ${c.new_path}\n${c.diff}`).join('\n\n');

  // Send to Gemini
  const prompt = `You are a senior software engineer. Please review the following GitLab Merge Request diff:\n${diff}`;

  const geminiRes = await axios.post(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    {
      contents: [{ parts: [{ text: prompt }] }]
    },
    { params: { key: process.env.GEMINI } }
  );

  const review = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;

  // Post review back to MR
  await axios.post(
    `http://repo.axxsoln.in/api/v4/projects/48/merge_requests/${mrIid}/notes`,
    { body: `🤖 AI Review:\n\n${review}` },
    { headers: { 'PRIVATE-TOKEN': process.env.SECRET } }
  );

  res.sendStatus(200);
});

app.listen(8000, () => console.log('Listening on port 8000'));
