const cheerio = require('cheerio')
const request = require('superagent')
const fs = require('fs')
// const targetUrl = 'http://tengine.taobao.org/book/chapter_01.html'
fs.unlink('./chapters',err => {
  if(err) {
    console.log(err)
    return
  }else {
    console.log('已清空')
  }
})
for(let i=1;i<=14;i++) {
  let targetUrl = `http://tengine.taobao.org/book/chapter_${i>9?i:'0'+i}.html`
  request.get(targetUrl)
  .then(res => {
    let txt = res.req.res.text
    const $ = cheerio.load(txt,{decodeEntities: false})
    fs.writeFile(`./chapters/chapter_${i>9?i:'0'+i}.md`,$('.body').html(),err => {
      if(err) {
        console.log(err)
        return
      }else {
        if(i == 14) {
          console.log('文件已全部保存')
        }
      }
    })
  })
}


