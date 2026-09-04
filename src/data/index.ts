// Minimal types for content.json
export type Project = {
  id: string
  title: string
  category: string
  location?: string
  status?: string
  image: string
  thumb?: string
  alt?: string
}

const content = require("./content.json")
module.exports = content
