## attention
当cheerio在解析节点时，需要添加 ` const $ = cheerio.load(txt,{decodeEntities: false})`
decodeEntities可以帮助将Unicode转换为中文字符 "# NginxCookBook" 
