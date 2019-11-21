
            
  <div class="section" id="nginx">
<h1>nginx基础设施<a class="headerlink" href="#nginx" title="永久链接至标题">¶</a></h1>
<div class="section" id="id1">
<h2>内存池<a class="headerlink" href="#id1" title="永久链接至标题">¶</a></h2>
<div class="section" id="id2">
<h3>简介:<a class="headerlink" href="#id2" title="永久链接至标题">¶</a></h3>
<p>Nginx里内存的使用大都十分有特色:申请了永久保存,抑或伴随着请求的结束而全部释放,还有写满了缓冲再从头接着写.这么做的原因也主要取决于Web Server的特殊的场景,内存的分配和请求相关,一条请求处理完毕,即可释放其相关的内存池,降低了开发中对内存资源管理的复杂度,也减少了内存碎片的存在.</p>
<p>所以在Nginx使用内存池时总是只申请,不释放,使用完毕后直接destroy整个内存池.我们来看下内存池相关的实现。</p>
</div>
<div class="section" id="id3">
<h3>结构:<a class="headerlink" href="#id3" title="永久链接至标题">¶</a></h3>
<div class="code c highlight-python"><pre>struct ngx_pool_s {
    ngx_pool_data_t       d;
    size_t                max;
    ngx_pool_t           *current;
    ngx_chain_t          *chain;
    ngx_pool_large_t     *large;
    ngx_pool_cleanup_t   *cleanup;
    ngx_log_t            *log;
};

struct ngx_pool_large_s {
    ngx_pool_large_t     *next;
    void                 *alloc;
};

typedef struct {
    u_char               *last;
    u_char               *end;
    ngx_pool_t           *next;
    ngx_uint_t            failed;
} ngx_pool_data_t;</pre>
</div>
<img alt="内存池" class="align-center" src="https://raw.github.com/yzprofile/nginx-book/master/source/images/chapter-10-1.PNG">
</div>
<div class="section" id="id4">
<h3>实现:<a class="headerlink" href="#id4" title="永久链接至标题">¶</a></h3>
<p>这三个数据结构构成了基本的内存池的主体.通过ngx_create_pool可以创建一个内存池,通过ngx_palloc可以从内存池中分配指定大小的内存。</p>
<div class="code c highlight-python"><pre>ngx_pool_t *
ngx_create_pool(size_t size, ngx_log_t *log)
{
    ngx_pool_t  *p;

    p = ngx_memalign(NGX_POOL_ALIGNMENT, size, log);
    if (p == NULL) {
        return NULL;
    }

    p->d.last = (u_char *) p + sizeof(ngx_pool_t);
    p->d.end = (u_char *) p + size;
    p->d.next = NULL;
    p->d.failed = 0;

    size = size - sizeof(ngx_pool_t);
    p->max = (size < NGX_MAX_ALLOC_FROM_POOL) ? size : NGX_MAX_ALLOC_FROM_POOL;

    p->current = p;
    p->chain = NULL;
    p->large = NULL;
    p->cleanup = NULL;
    p->log = log;

    return p;
}</pre>
</div>
<p>这里首申请了一块大小为size的内存区域，其前sizeof(ngx_pool_t)字节用来存储ngx_pool_t这个结构体自身自身.所以若size小于sizeof(ngx_pool_t)将会有coredump的可能性。</p>
<p>我们常用来分配内存的有三个接口:ngx_palloc，ngx_pnalloc，ngx_pcalloc。</p>
<p>分别来看下它们的实现：</p>
<div class="code c highlight-python"><pre> void *
 ngx_palloc(ngx_pool_t *pool, size_t size)
 {
     u_char      *m;
     ngx_pool_t  *p;

     if (size <= pool->max) {

         p = pool->current;

         do {
             m = ngx_align_ptr(p->d.last, NGX_ALIGNMENT);

             if ((size_t) (p->d.end - m) >= size) {
                 p->d.last = m + size;

                 return m;
             }

             p = p->d.next;

         } while (p);

         return ngx_palloc_block(pool, size);
     }

     return ngx_palloc_large(pool, size);
 }


 void *
 ngx_pnalloc(ngx_pool_t *pool, size_t size)
 {
     u_char      *m;
     ngx_pool_t  *p;

     if (size <= pool->max) {

         p = pool->current;

         do {
             m = p->d.last;

             if ((size_t) (p->d.end - m) >= size) {
                 p->d.last = m + size;

                 return m;
             }

             p = p->d.next;

         } while (p);

         return ngx_palloc_block(pool, size);
     }

     return ngx_palloc_large(pool, size);
 }


 void *
 ngx_pcalloc(ngx_pool_t *pool, size_t size)
 {
     void *p;

     p = ngx_palloc(pool, size);
     if (p) {
         ngx_memzero(p, size);
     }

     return p;
}</pre>
</div>
<p>ngx_pcalloc其只是ngx_palloc的一个封装，将申请到的内存全部初始化为0。</p>
<p>ngx_palloc相对ngx_pnalloc，其会将申请的内存大小向上扩增到NGX_ALIGNMENT的倍数，以方便内存对齐，减少内存访问次数。</p>
<p>Nginx的内存池不仅用于内存方面的管理，还可以通过`ngx_pool_cleanup_add`来添加内存池释放时的回调函数，以便用来释放自己申请的其他相关资源。</p>
<p>从代码中可以看出，这些由自己添加的释放回调是以链表形式保存的，也就是说你可以添加多个回调函数来管理不同的资源。</p>
</div>
</div>
<div class="section" id="id5">
<h2>共享内存<a class="headerlink" href="#id5" title="永久链接至标题">¶</a></h2>
<div class="section" id="slab">
<h3>slab算法<a class="headerlink" href="#slab" title="永久链接至标题">¶</a></h3>
</div>
</div>
<div class="section" id="buffer">
<h2>buffer管理<a class="headerlink" href="#buffer" title="永久链接至标题">¶</a></h2>
<div class="section" id="id6">
<h3>buffer重用机制<a class="headerlink" href="#id6" title="永久链接至标题">¶</a></h3>
</div>
<div class="section" id="id7">
<h3>buffer防拷贝机制<a class="headerlink" href="#id7" title="永久链接至标题">¶</a></h3>
</div>
</div>
<div class="section" id="chain">
<h2>chain管理<a class="headerlink" href="#chain" title="永久链接至标题">¶</a></h2>
<div class="section" id="id8">
<h3>chain重用机制<a class="headerlink" href="#id8" title="永久链接至标题">¶</a></h3>
</div>
</div>
<div class="section" id="aio">
<h2>aio原理<a class="headerlink" href="#aio" title="永久链接至标题">¶</a></h2>
</div>
<div class="section" id="id9">
<h2>锁实现<a class="headerlink" href="#id9" title="永久链接至标题">¶</a></h2>
</div>
<div class="section" id="id10">
<h2>基本数据结构<a class="headerlink" href="#id10" title="永久链接至标题">¶</a></h2>
</div>
<div class="section" id="id11">
<h2>时间缓存<a class="headerlink" href="#id11" title="永久链接至标题">¶</a></h2>
</div>
<div class="section" id="id12">
<h2>文件缓存<a class="headerlink" href="#id12" title="永久链接至标题">¶</a></h2>
</div>
<div class="section" id="log">
<h2>log机制<a class="headerlink" href="#log" title="永久链接至标题">¶</a></h2>
</div>
</div>


          