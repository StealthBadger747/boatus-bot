const puppeteer = require('puppeteer');

const username = ""; //TODO: Enter username for boat-ed.com
const password = ""; //TODO: Enter password for boat-ed.com
const defaultTimeoutMS = 20000;

async function clickCorrectAnswers(pageFrame) {
    return await pageFrame.evaluate(() => {
        function findItemLocal(targetId) {
            console.log('targetId', targetId);
            for (let module of Object.values(dataStorage.courseStructure.modules)) {
                for (let object of Object.values(module.objects)) {
                    for (let question of Object.values(object.questions)) {
                        for (let option of Object.values(question.options)) {
                            if (targetId == option.element_id) {
                                return option;
                            }
                        }
                    }
                }
            }
        
            return null;
        }


        for (let question of document.querySelectorAll('input[name^="questionOption"]')){
            console.log('value', question.getAttribute('value'))
            const optionPrefix = question.getAttribute('value');
            const targetId = question.getAttribute('id').replace(optionPrefix, '');
            const item = findItemLocal(targetId);
            if (item.correct) {
                console.log('Found question:', item);
                question.click();
            }
        }
    });
}

async function getAnswers(pageFrame) {
    console.log('GETTING ANSWERS!');
    await pageFrame.waitForSelector('#contentFrame', {visible: true, timeout: defaultTimeoutMS });

    while (true) {
        await clickCorrectAnswers(pageFrame);
        console.log('Selected answers');

        const submitButton = await pageFrame.waitForXPath('//button[text()="Submit"]', {visible: true, timeout: defaultTimeoutMS });
        await submitButton.click();
        console.log('Clicked submit');

        await delay(1000);

        const closeButton = await pageFrame.waitForSelector('button[class="btn btn-default dismiss"]', {visible: true, timeout: defaultTimeoutMS });
        await closeButton.click();
        console.log('Closed dialouge');

        await delay(1000);

        // The submit button turns into the "Next" Button
        await submitButton.click();
        console.log('Next Clicked');

        await delay(1500);

        // If the screen counter goes invisible then it is safe to assume the quiz is done.
        const screenCounterIsVisible = await pageFrame.evaluate(() => {
            const element = document.querySelector('p[id="screenCount"]');
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
          
            return style.visibility !== 'hidden' && !!(rect.bottom || rect.top || rect.height || rect.width);
        });
        if (!screenCounterIsVisible) { break }
    }

    // Click the continue button at the end
    const targetElement = await pageFrame.waitForXPath('//span[text()="Continue"]');
    const continueButton = await (await targetElement.getProperty('parentNode')).getProperty('parentNode');
    console.log('continueButton', continueButton);
    await continueButton.click();

    console.log('Finished quiz!');
}

async function findQuizButton(pageFrame) {
    const quizPrompt = await pageFrame.$x('//div[text()="Continue to Quiz"]');
    if (quizPrompt[0] == undefined || quizPrompt[0] == null) {
        return null;
    }
    else if (await (await quizPrompt[0].getProperty('innerText')).jsonValue()) {
        return quizPrompt[0];
    }

    return null;
}
function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }

(async () => {
    if (!username || !password) {
        console.log("ERROR: username and/or password have not bee provided!")
        return
    }

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('https://courses.boatus.org/');
    const lb = await page.waitForSelector('a.css-1f9ug9o:nth-child(2)', {visible: true, timeout: defaultTimeoutMS });
    await lb.click();
    await page.waitForNavigation();

    const emailXPath = '/html/body/div/div/div[2]/form/div/div/div[3]/span/div/div/div/div/div/div/div/div/div[4]/div[1]/div/input';
    const passwordXPath = '/html/body/div/div/div[2]/form/div/div/div[3]/span/div/div/div/div/div/div/div/div/div[4]/div[2]/div/div/input';
    const loginButtonXPath = '/html/body/div/div/div[2]/form/div/div/button';

    const emailElement = await page.waitForXPath(emailXPath, {visible: true, timeout: defaultTimeoutMS });
    await emailElement.click();
    await emailElement.type(username);

    const passwordElement = await page.waitForXPath(passwordXPath, {visible: true, timeout: defaultTimeoutMS });
    await passwordElement.type(password);

    const loginButtonElement = await page.waitForXPath(loginButtonXPath, {visible: true, timeout: defaultTimeoutMS });
    await loginButtonElement.click();
    await page.waitForNavigation();

    const courses = await page.waitForSelector('nav.jsx-2212072244:nth-child(3) > ul:nth-child(1) > li:nth-child(1) > a:nth-child(1)', {visible: true, timeout: defaultTimeoutMS });
    await courses.click();
    await page.waitForNavigation();

    const launchCourse = await page.waitForSelector('.incomplete', {visible: true, timeout: defaultTimeoutMS });
    await launchCourse.click();
    await page.waitForNavigation();

    console.log("waiting on button");
    const scormdriverContent = await page.waitForSelector('#scormdriver_content', {visible: false, timeout: 0 })
    const pageFrame = await scormdriverContent.contentFrame();

    let current_quiz = "";

    let doingQuizRightNow = false;

    while (true) {
        await pageFrame.waitForSelector('#navbar_module_title', {visible: true, timeout: 0 });
        const foundQuizButton = await findQuizButton(pageFrame);
        const regex = /Course End/i;
        const navbarTitle = await pageFrame.$eval('#navbar_module_title', e => e.textContent);
        let m;
        if ((m = regex.exec(navbarTitle)) !== null) {
            console.log('Course is done!');
            break;
        }
        else if (foundQuizButton && !doingQuizRightNow) {
            doingQuizRightNow = true;
            current_quiz = navbarTitle;
            foundQuizButton.click();
            await delay(1000);
            foundQuizButton.click();
            await delay(1000);
            foundQuizButton.click();
            await delay(1000);
            foundQuizButton.click();
            await getAnswers(pageFrame);
        }
        else if (current_quiz != navbarTitle) {
            doingQuizRightNow = false;
            const forwardButton = await pageFrame.waitForSelector('#forwardButton', {visible: true, timeout: 0 });
            await pageFrame.$eval('#forwardButton', e => {
                e.setAttribute("class", "navbar-link");
                e.setAttribute("aria-hidden", "false");
            });
            await forwardButton.click();
            console.log("button clicked!");
        }

        await delay(100);
    }

})();
