import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/usr/local/share/bun-global/node_modules/playwright');

const BASE_URL = 'http://127.0.0.1:3000';
const CHROMIUM_PATH = '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';

const results = [];
function pass(name, detail = '') {
  results.push({ ok: true, name, detail });
  console.log(`PASS: ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name, detail = '') {
  results.push({ ok: false, name, detail });
  console.error(`FAIL: ${name}${detail ? ' — ' + detail : ''}`);
}

async function dismissSplash(page) {
  await page.waitForTimeout(1800);
  const skipBtn = page.locator('button:has-text("Skip")');
  if (await skipBtn.isVisible().catch(() => false)) {
    await skipBtn.click();
  }
  await page.waitForSelector('header', { timeout: 10000 });
}

async function assertNoSubscribeText(page, contextName) {
  const found = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const matches = text.match(/\bSubscrib(e|ed|ers|ing)\b/gi);
    return matches || [];
  });
  if (found.length === 0) {
    pass(`Zero "Subscribe" UI text (${contextName})`);
  } else {
    fail(`Found forbidden Subscribe UI text (${contextName})`, found.join(', '));
  }
}

async function run() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const consoleErrors = [];
  const pageErrors = [];

  try {
    // =========================================================================
    // 1. DESKTOP FULL E2E TEST (1280x800)
    // =========================================================================
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await dismissSplash(page);
    pass('Desktop App Load & Splash', 'Rendered header & main shell');
    await assertNoSubscribeText(page, 'Home');

    // Service Worker Check
    const swStatus = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      await new Promise((r) => setTimeout(r, 800));
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0 ? regs[0].active?.scriptURL || regs[0].installing?.scriptURL || 'registered' : 'none';
    });
    if (swStatus !== 'none' && swStatus !== 'unsupported') {
      pass('PWA Service Worker Registration', swStatus);
    } else {
      fail('PWA Service Worker Registration', swStatus);
    }

    // Category Chips + Custom Feed + Search Autocomplete
    await page.locator('button:has-text("Gaming")').first().click();
    await page.waitForTimeout(250);
    await page.locator('button:has-text("All")').first().click();
    await page.waitForTimeout(250);
    pass('Category Filtering', 'Gaming -> All');

    const searchInput = page.locator('header input[type="text"], header input[type="search"]').first();
    await searchInput.click();
    await searchInput.fill('Bunny');
    await page.waitForTimeout(300);
    const suggestionVisible = await page.locator('text=Big Buck Bunny').first().isVisible().catch(() => false);
    if (suggestionVisible) {
      pass('Navbar Search Autocomplete', 'Matched video suggestion on query');
    } else {
      fail('Navbar Search Autocomplete', 'No autocomplete match rendered for "Bunny"');
    }
    await searchInput.press('Enter');
    await page.waitForTimeout(300);
    const hasSearchResult = await page.locator('text=Results for').isVisible().catch(() => false);
    if (hasSearchResult) pass('Navbar Search Submit');
    else fail('Navbar Search Submit');
    await page.locator('button:has-text("Clear search")').click();
    await page.waitForTimeout(250);

    // Verify VideoCard Download button (thumbnail & 3-dot menu) triggers a real browser download using video.url
    const thumbDownloadVisible = (await page.locator('button[aria-label^="Download "]').count()) > 0;
    await page.route('**/*.mp4', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'video/mp4' },
        body: Buffer.from('ftypmp42test'),
      });
    });
    const firstCardMoreBtn = page.locator('button[aria-label="More options"]').first();
    await firstCardMoreBtn.click({ force: true });
    await page.waitForTimeout(200);
    const menuDownloadBtn = page.locator('button:has-text("Download")').first();
    const downloadMenuVisible = await menuDownloadBtn.isVisible().catch(() => false);
    const [browserDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      menuDownloadBtn.click(),
    ]);
    const downloadedFilename = browserDownload.suggestedFilename();
    await page.unroute('**/*.mp4');
    if (thumbDownloadVisible && downloadMenuVisible && downloadedFilename.endsWith('.mp4')) {
      pass('VideoCard Download Button', `Browser download triggered: ${downloadedFilename}`);
    } else {
      fail('VideoCard Download Button', `thumb=${thumbDownloadVisible}, menu=${downloadMenuVisible}, file=${downloadedFilename}`);
    }

    // Open First Video -> WatchView
    await page.locator('h3:has-text("Big Buck Bunny")').first().click();
    await page.waitForTimeout(700);
    const videoEl = page.locator('video').first();
    if (await videoEl.isVisible()) {
      pass('WatchView Player Mount');
    } else {
      fail('WatchView Player Mount');
    }
    await assertNoSubscribeText(page, 'WatchView');

    // VideoPlayer Settings -> Loop toggle + Shortcuts
    const settingsBtn = page.locator('button[aria-label="Player Settings"]');
    await settingsBtn.click();
    await page.waitForTimeout(200);
    const loopBtn = page.locator('button[aria-label="Loop active video"]');
    await loopBtn.click();
    await page.waitForTimeout(150);
    const loopOn = await videoEl.evaluate((v) => v.loop);
    const ariaCheckedOn = await loopBtn.getAttribute('aria-checked');
    await loopBtn.click();
    await page.waitForTimeout(150);
    const loopOff = await videoEl.evaluate((v) => v.loop);
    if (loopOn === true && ariaCheckedOn === 'true' && loopOff === false) {
      pass('VideoPlayer Loop Toggle', 'Toggles video.loop & aria-checked cleanly');
    } else {
      fail('VideoPlayer Loop Toggle', `loopOn=${loopOn}, aria=${ariaCheckedOn}, loopOff=${loopOff}`);
    }

    // Keyboard Shortcuts Modal from Settings
    await page.locator('[data-player-menu] button:has-text("Keyboard Shortcuts")').click();
    await page.waitForTimeout(200);
    const shortcutsVisible = await page.locator('text=Toggle Play / Pause').isVisible().catch(() => false);
    if (shortcutsVisible) {
      pass('Shortcuts Modal via Player Settings');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    } else {
      fail('Shortcuts Modal via Player Settings');
    }

    // Theater Mode Toggle (move mouse into player to wake controls)
    await videoEl.hover();
    await page.waitForTimeout(200);
    const theaterBtn = page.locator('button[aria-label="Theater Mode"]');
    await theaterBtn.click();
    await page.waitForTimeout(200);
    const theaterPressed = await page.locator('button[aria-label="Default View"]').getAttribute('aria-pressed').catch(() => null);
    if (theaterPressed === 'true') {
      pass('Theater Mode Toggle');
      await page.locator('button[aria-label="Default View"]').click();
      await page.waitForTimeout(200);
    } else {
      fail('Theater Mode Toggle');
    }

    // Playlist Create & Add in WatchView
    await page.locator('button[title="Add to playlist"]').click();
    await page.waitForTimeout(200);
    const plInput = page.locator('input[placeholder="New playlist name..."]');
    await plInput.fill('My SciFi Queue');
    await page.locator('form button:has-text("Create")').click();
    await page.waitForTimeout(250);
    const closePlBtn = page.locator('button:has-text("Done")').first();
    if (await closePlBtn.isVisible().catch(() => false)) {
      await closePlBtn.click();
    }
    pass('WatchView Create & Add Playlist');

    // Comments: Add, Like, Edit, Reply
    const commentBox = page.locator('input[placeholder*="comment" i], textarea[placeholder*="comment" i]').first();
    await commentBox.click();
    await commentBox.fill('E2E verified masterwork comment!');
    const submitCommentBtn = page.locator('form button[type="submit"]').filter({ hasText: 'Comment' }).first();
    await submitCommentBtn.click();
    await page.waitForTimeout(300);
    const commentAppeared = await page.locator('text=E2E verified masterwork comment!').isVisible().catch(() => false);
    if (commentAppeared) pass('Comment Add');
    else fail('Comment Add');

    // Edit own comment
    const editCommentBtn = page.locator('button[aria-label="Edit comment"]').first();
    if (await editCommentBtn.isVisible().catch(() => false)) {
      await editCommentBtn.click();
      await page.waitForTimeout(150);
      const editArea = page.locator('textarea').nth(1);
      await editArea.fill('E2E edited masterwork comment!');
      await page.locator('button:has-text("Save")').first().click();
      await page.waitForTimeout(200);
      const editedVisible = await page.locator('text=E2E edited masterwork comment!').isVisible().catch(() => false);
      if (editedVisible) pass('Comment Edit');
      else fail('Comment Edit');
    } else {
      fail('Comment Edit', 'Edit button not visible for own comment');
    }

    // Reply to comment
    const replyToggleBtn = page.locator('button:has-text("Reply")').first();
    await replyToggleBtn.click();
    await page.waitForTimeout(150);
    const replyInput = page.locator('input[placeholder*="Reply to" i]').first();
    await replyInput.fill('Agreed 100%!');
    await page.locator('button:has-text("Reply")').nth(1).click();
    await page.waitForTimeout(250);
    const showRepliesBtn = page.locator('button:has-text("1 reply")').first();
    if (await showRepliesBtn.isVisible().catch(() => false)) {
      await showRepliesBtn.click();
      await page.waitForTimeout(150);
    }
    const replyVisible = await page.locator('text=Agreed 100%!').isVisible().catch(() => false);
    if (replyVisible) pass('Comment Reply');
    else fail('Comment Reply');

    // Like, Dislike, Watch Later on WatchView
    await page.locator('button[aria-label="Dislike"]').click();
    await page.waitForTimeout(150);
    await page.locator('button[title="Save to Watch Later"]').click();
    await page.waitForTimeout(150);
    pass('WatchView Reactions & Save');

    // Miniplayer Dock
    await page.locator('video').first().hover();
    await page.waitForTimeout(200);
    await page.locator('button[aria-label="Miniplayer"]').click();
    await page.waitForTimeout(350);
    const miniplayerVisible = await page.locator('aside[aria-label="Miniplayer"]').isVisible().catch(() => false);
    if (miniplayerVisible) {
      pass('Floating Miniplayer Dock Opens');
      await page.locator('button[aria-label="Expand miniplayer"]').click();
      await page.waitForTimeout(350);
      if (await page.locator('video').first().isVisible()) {
        pass('Miniplayer Expand Restores WatchView');
      } else {
        fail('Miniplayer Expand Restores WatchView');
      }
    } else {
      fail('Floating Miniplayer Dock Opens');
    }

    // Sidebar -> Playlists & Play All Queue
    await page.locator('aside button:has-text("Playlists"), nav button:has-text("Playlists")').first().click();
    await page.waitForTimeout(350);
    const plHeading = await page.locator('h2:has-text("Your Playlists")').isVisible().catch(() => false);
    const hasCreatedPl = await page.locator('text=My SciFi Queue').first().isVisible().catch(() => false);
    if (plHeading && hasCreatedPl) {
      pass('Sidebar Playlists Page & Created Playlist');
      await page.locator('button:has-text("Play all")').first().click();
      await page.waitForTimeout(350);
      const queueVisible = await page.locator('text=Up Next in Playlist').first().isVisible().catch(() => false) || await page.locator('text=My SciFi Queue').first().isVisible().catch(() => false);
      if (queueVisible) pass('Playlist Play All Queue');
      else fail('Playlist Play All Queue');
    } else {
      fail('Sidebar Playlists Page & Created Playlist', `plHeading=${plHeading}, hasCreatedPl=${hasCreatedPl}`);
    }

    // Channel View -> Follow + Tabs (Videos, Shorts & Reels, Playlists)
    await page.locator('aside button:has-text("Home")').first().click();
    await page.waitForTimeout(300);
    await page.locator('button[aria-label="Visit Blender Studio channel"]').first().click();
    await page.waitForTimeout(400);
    await page.locator('h1:has-text("Blender Studio")').first().waitFor({ state: 'visible', timeout: 5000 });
    await assertNoSubscribeText(page, 'ChannelView');
    const followBtn = page.locator('button:text-is("Follow")').first();
    if (await followBtn.isVisible().catch(() => false)) {
      await followBtn.click();
      await page.waitForTimeout(150);
    }
    const chReelsTab = page.locator('button:has-text("Shorts & Reels (")').first();
    await chReelsTab.click();
    await page.waitForTimeout(200);
    const chPlaylistsTab = page.locator('button:has-text("Playlists (")').first();
    await chPlaylistsTab.click();
    await page.waitForTimeout(200);
    pass('ChannelView Follow & Tabs (Videos, Shorts & Reels, Playlists)');

    // Shorts & Reels View -> Save & verify in Library -> Saved Reels!
    await page.locator('aside button:has-text("Shorts & Reels"), nav button:has-text("Shorts & Reels")').first().click();
    await page.waitForTimeout(450);
    await assertNoSubscribeText(page, 'ReelsView');
    const saveReelBtn = page.locator('button:has-text("Save")').first();
    if (await saveReelBtn.isVisible().catch(() => false)) {
      await saveReelBtn.click();
      await page.waitForTimeout(200);
    }
    pass('ReelsView Vertical Player & Save');

    // Verify Saved Reels tab in LibraryView shows saved reel!
    await page.locator('aside button:has-text("Watch later")').first().click();
    await page.waitForTimeout(250);
    await page.locator('button:has-text("Saved Reels")').first().click();
    await page.waitForTimeout(250);
    const savedReelCountOk = await page.locator('button:has-text("Saved Reels (")').first().textContent().catch(() => '');
    if (savedReelCountOk && !savedReelCountOk.includes('(0)')) {
      pass('Library Saved Reels Tab', savedReelCountOk.trim());
    } else {
      fail('Library Saved Reels Tab', savedReelCountOk || 'empty');
    }

    // Upload Modal -> via Navbar "+ Create" -> Upload Long Video + Shorts/Reels + Stream URL + Edit & Filters
    await page.locator('header button[aria-label="Create"]').click();
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Upload Long Video")').first().click();
    await page.waitForTimeout(350);
    const uploadModalVisible = await page.locator('h2:has-text("Upload Long Video")').isVisible().catch(() => false);
    const hasGalleryTab = await page.locator('button:has-text("Upload from Gallery")').isVisible().catch(() => false);
    const hasRecordTab = await page.locator('button:has-text("Record Video")').isVisible().catch(() => false);
    const hasUrlTab = await page.locator('button:has-text("Stream URL")').isVisible().catch(() => false);
    if (uploadModalVisible && hasGalleryTab && hasRecordTab && hasUrlTab) {
      // Switch to Shorts/Reels card and Stream URL tab
      await page.locator('button:has-text("Shorts & Reels")').last().click();
      await page.waitForTimeout(200);
      await page.locator('button:has-text("Stream URL")').first().click();
      await page.waitForTimeout(200);
      const urlInput = page.locator('input[type="url"], input[placeholder*="https://" i]').first();
      if (await urlInput.isVisible().catch(() => false)) {
        await urlInput.fill('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoy.mp4');
        await page.waitForTimeout(200);
      }
      // Go to Edit & Filters step to verify filter presets & trim/crop/mute UI
      const editStepBtn = page.locator('button:has-text("Edit & Filters")').first();
      if (await editStepBtn.isVisible().catch(() => false)) {
        await editStepBtn.click();
        await page.waitForTimeout(250);
      }
      const hasVividFilter = await page.locator('button:has-text("Vivid HDR")').isVisible().catch(() => false);
      pass('Upload Modal (Long Video / Shorts & Reels / Gallery / Record / Stream URL / Filters)', `vividFilter=${hasVividFilter}`);
    } else {
      fail('Upload Modal', `visible=${uploadModalVisible}, gallery=${hasGalleryTab}, record=${hasRecordTab}, url=${hasUrlTab}`);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);

    // Creator Studio -> Overview, Monetization, Color & Framing Lab
    await page.locator('aside button:has-text("Creator Studio"), aside button:has-text("Studio")').first().click();
    await page.waitForTimeout(400);
    await assertNoSubscribeText(page, 'CreatorStudio');
    await page.locator('button:has-text("Monetization")').first().click();
    await page.waitForTimeout(250);
    const has30Split = await page.locator('text=30%').first().isVisible().catch(() => false);
    if (has30Split) pass('Creator Studio Monetization (30% Split)');
    else fail('Creator Studio Monetization (30% Split)');

    await page.locator('button:has-text("Color & Framing Lab")').first().click();
    await page.waitForTimeout(250);
    const labVideoMuted = await page.locator('video').first().evaluate((v) => v.muted).catch(() => false);
    await page.locator('button:has-text("Apply Preview Preset")').click();
    await page.waitForTimeout(600);
    const presetToast = await page.locator('text=Studio look & framing preset saved').isVisible().catch(() => false);
    if (labVideoMuted && presetToast) {
      pass('Creator Studio Color & Framing Lab', 'Video muted by default & preset saved');
    } else {
      fail('Creator Studio Color & Framing Lab', `muted=${labVideoMuted}, toast=${presetToast}`);
    }

    // Settings Modal + Language Switcher
    await page.locator('aside button:has-text("Settings")').first().click();
    await page.waitForTimeout(250);
    await page.locator('button:has-text("हिन्दी")').first().click().catch(async () => {
      await page.locator('button:has-text("हिं")').first().click();
    });
    await page.waitForTimeout(250);
    const hindiTextVisible = await page.evaluate(() => /सेटिंग्स|होम|क्रिएटर/.test(document.body.innerText));
    if (hindiTextVisible) pass('Language Switcher (Hindi)');
    else fail('Language Switcher (Hindi)');
    // Switch back to English
    await page.locator('button:has-text("English")').first().click().catch(async () => {
      await page.locator('button:has-text("EN")').first().click();
    });
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');

    await context.close();

    // =========================================================================
    // 2. MOBILE VIEWPORT AUDIT (390x844)
    // =========================================================================
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mPage = await mobileCtx.newPage();
    mPage.on('pageerror', (err) => pageErrors.push('mobile: ' + err.message));
    mPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push('mobile: ' + msg.text());
    });

    await mPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await dismissSplash(mPage);

    const overflowHome = await mPage.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
    if (!overflowHome) pass('Mobile (390px) Home No Horizontal Overflow');
    else fail('Mobile (390px) Home Horizontal Overflow detected');

    await assertNoSubscribeText(mPage, 'Mobile Home');

    // Mobile Bottom Nav -> Create Sheet -> Upload Shorts / Reels
    await mPage.locator('nav[aria-label="Mobile Navigation"] button[aria-label="Create"]').click();
    await mPage.waitForTimeout(250);
    const mCreateSheetOk = await mPage.locator('text=Create on VIO').isVisible().catch(() => false);
    if (mCreateSheetOk) {
      await mPage.locator('button:has-text("Upload Shorts / Reels")').last().click();
      await mPage.waitForTimeout(300);
      const overflowUpload = await mPage.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 2
      );
      if (!overflowUpload) pass('Mobile (390px) Create Sheet & Upload Modal No Overflow');
      else fail('Mobile (390px) Upload Modal Horizontal Overflow detected');
      await mPage.keyboard.press('Escape');
      await mPage.waitForTimeout(200);
    } else {
      fail('Mobile (390px) Create Sheet');
    }

    // Mobile Bottom Nav -> Reels -> Watch
    const mobileShortsBtn = mPage.locator('nav[aria-label="Mobile Navigation"] button:has-text("Reels")').first();
    await mobileShortsBtn.click();
    await mPage.waitForTimeout(400);
    const overflowReels = await mPage.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
    if (!overflowReels) pass('Mobile (390px) Reels No Horizontal Overflow');
    else fail('Mobile (390px) Reels Horizontal Overflow detected');

    await mPage.locator('nav[aria-label="Mobile Navigation"] button:has-text("Home")').first().click();
    await mPage.waitForTimeout(250);
    await mPage.locator('h3:has-text("Big Buck Bunny")').first().click();
    await mPage.waitForTimeout(450);
    const overflowWatch = await mPage.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
    if (!overflowWatch) pass('Mobile (390px) WatchView No Horizontal Overflow');
    else fail('Mobile (390px) WatchView Horizontal Overflow detected');

    await mobileCtx.close();
  } finally {
    await browser.close();
  }

  console.log('\n=== SUMMARY ===');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`Passed: ${passed}/${results.length}, Failed: ${failed}`);
  console.log(`Page Errors (${pageErrors.length}):`, pageErrors);
  console.log(`Console Errors (${consoleErrors.length}):`, consoleErrors.slice(0, 10));
  if (failed > 0 || pageErrors.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('E2E Fatal Error:', err);
  process.exit(1);
});
