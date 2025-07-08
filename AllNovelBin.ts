import {
    Source,
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    MangaTile,
    TagSection,
    TagType,
    ContentRating,
    Request,
    Response,
    SourceInfo,
    MangaStatus
} from "paperback-extensions-common";

export const AllNovelBinInfo: SourceInfo = {
    version: '1.0.2',
    name: 'AllNovelBin',
    icon: 'icon.png',
    author: 'Paperback',
    authorWebsite: '',
    description: 'Extension for AllNovelBin - English novels',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: 'https://allnovelbin.net',
    language: 'en',
    sourceTags: [
        {
            text: 'Novels',
            type: TagType.GREY
        },
        {
            text: 'English',
            type: TagType.GREY
        }
    ],
    repositoryBaseUrl: "https://github.com/haych101/Paperback-extensions",
    repositoryBranch: "main",
    sourcePath: "/AllNovelBin.ts"
};

export class AllNovelBin extends Source {
    readonly baseUrl = 'https://allnovelbin.net';

    async getMangaDetails(mangaId: string): Promise<Manga> {
        const request = createRequestObject({
            url: mangaId,
            method: 'GET',
            headers: {
                'referer': this.baseUrl,
                'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
            }
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);

        const title = $("h3.title").text().trim();
        const author = $("ul.info-meta > li:contains('Author')").text().replace("Author:", "").trim();
        const desc = $("div.desc-text").text().trim();
        const genres = $("ul.info-meta > li:contains('Genre')").text().replace("Genre:", "").split(",").map(tag => tag.trim());
        const image = $("img.img-responsive").attr("src") ?? "";
        
        let status = MangaStatus.ONGOING;
        const statusText = $("ul.info-meta > li:contains('Status')").text().toLowerCase();
        if (statusText.includes("completed")) {
            status = MangaStatus.COMPLETED;
        }

        const tagSections: TagSection[] = [];
        if (genres.length > 0) {
            tagSections.push(createTagSection({
                id: "genres",
                label: "Genres",
                tags: genres.map(g => createTag({ id: g, label: g }))
            }));
        }

        return createManga({
            id: mangaId,
            titles: [title],
            image: image,
            rating: 0,
            status: status,
            author: author,
            artist: author,
            desc: desc,
            tags: tagSections
        });
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const idMatch = mangaId.match(/novelId=(\d+)/);
        const novelId = idMatch ? idMatch[1] : null;
        if (!novelId) throw new Error("Novel ID not found");

        const url = `${this.baseUrl}/ajax/chapter-archive?novelId=${novelId}`;
        const request = createRequestObject({
            url,
            method: "GET",
            headers: {
                "referer": mangaId,
                "x-requested-with": "XMLHttpRequest"
            }
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        const chapters: Chapter[] = [];

        $("li").each((_, elem) => {
            const chapterUrl = $(elem).find("a").attr("href")?.trim();
            const chapterName = $(elem).find("span.nchr-text").text().trim();
            const chapterNum = Number(chapterName.match(/\d+/)?.[0] ?? 0);

            if (chapterUrl) {
                chapters.push(createChapter({
                    id: chapterUrl,
                    mangaId: mangaId,
                    name: chapterName,
                    langCode: "en",
                    chapNum: chapterNum,
                    time: new Date()
                }));
            }
        });

        return chapters.reverse();
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = createRequestObject({
            url: chapterId,
            method: "GET",
            headers: {
                "referer": mangaId
            }
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        const paragraphs = $("div.chapter-content p").map((_, el) => $(el).text().trim()).get();
        
        const filteredParagraphs = paragraphs.filter(p => p.length > 0);
        const content = filteredParagraphs.join("<br><br>");

        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            langCode: "en",
            pages: [],
            longStrip: false,
            html: content
        });
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<MangaTile[]> {
        const searchUrl = `${this.baseUrl}/search?keyword=${encodeURIComponent(query.title ?? "")}`;
        const request = createRequestObject({
            url: searchUrl,
            method: "GET",
            headers: {
                "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
            }
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        const results: MangaTile[] = [];

        $("div.list-novel > div.row").each((_, elem) => {
            const title = $(elem).find("h3.novel-title").text().trim();
            const image = $(elem).find("img").attr("data-src") ?? "";
            const url = $(elem).find("h3 > a").attr("href") ?? "";
            const latestChapter = $(elem).find("span.chr-text").text().trim();

            results.push(createMangaTile({
                id: url,
                image,
                title: createIconText({ text: title }),
                subtitleText: createIconText({ text: latestChapter || "AllNovelBin" })
            }));
        });

        return results;
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sections = [
            {
                request: createRequestObject({
                    url: `${this.baseUrl}/sort/daily-update-novels`,
                    method: "GET"
                }),
                section: createHomeSection({
                    id: "daily_updates",
                    title: "Daily Updates",
                    view_more: true
                })
            },
            {
                request: createRequestObject({
                    url: `${this.baseUrl}/sort/hot-all-novel-bin`,
                    method: "GET"
                }),
                section: createHomeSection({
                    id: "hot_novels",
                    title: "Hot Novels",
                    view_more: true
                })
            },
            {
                request: createRequestObject({
                    url: `${this.baseUrl}/sort/completed-all-novel-bin`,
                    method: "GET"
                }),
                section: createHomeSection({
                    id: "completed_novels",
                    title: "Completed Novels",
                    view_more: true
                })
            },
            {
                request: createRequestObject({
                    url: `${this.baseUrl}/sort/popular-all-novel-bin`,
                    method: "GET"
                }),
                section: createHomeSection({
                    id: "popular_novels",
                    title: "Most Popular",
                    view_more: true
                })
            }
        ];

        const promises: Promise<void>[] = [];

        for (const section of sections) {
            sectionCallback(section.section);
            promises.push(
                this.requestManager.schedule(section.request, 1).then(response => {
                    const $ = this.cheerio.load(response.data);
                    const tiles: MangaTile[] = [];

                    $("div.list-novel > div.row").each((_, elem) => {
                        const title = $(elem).find("h3.novel-title").text().trim();
                        const image = $(elem).find("img").attr("data-src") ?? "";
                        const url = $(elem).find("h3 > a").attr("href") ?? "";
                        const latestChapter = $(elem).find("span.chr-text").text().trim();

                        tiles.push(createMangaTile({
                            id: url,
                            image,
                            title: createIconText({ text: title }),
                            subtitleText: createIconText({ text: latestChapter || "AllNovelBin" })
                        }));
                    });

                    section.section.items = tiles;
                    sectionCallback(section.section);
                })
            );
        }

        await Promise.all(promises);
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<MangaTile[]> {
        let url = '';
        let page = metadata?.page ?? 1;

        switch (homepageSectionId) {
            case "daily_updates":
                url = `${this.baseUrl}/sort/daily-update-novels?page=${page}`;
                break;
            case "hot_novels":
                url = `${this.baseUrl}/sort/hot-all-novel-bin?page=${page}`;
                break;
            case "completed_novels":
                url = `${this.baseUrl}/sort/completed-all-novel-bin?page=${page}`;
                break;
            case "popular_novels":
                url = `${this.baseUrl}/sort/popular-all-novel-bin?page=${page}`;
                break;
            default:
                return Promise.resolve([]);
        }

        const request = createRequestObject({
            url,
            method: "GET"
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        const tiles: MangaTile[] = [];

        $("div.list-novel > div.row").each((_, elem) => {
            const title = $(elem).find("h3.novel-title").text().trim();
            const image = $(elem).find("img").attr("data-src") ?? "";
            const url = $(elem).find("h3 > a").attr("href") ?? "";
            const latestChapter = $(elem).find("span.chr-text").text().trim();

            tiles.push(createMangaTile({
                id: url,
                image,
                title: createIconText({ text: title }),
                subtitleText: createIconText({ text: latestChapter || "AllNovelBin" })
            }));
        });

        metadata.page = page + 1;
        return tiles;
    }
}
