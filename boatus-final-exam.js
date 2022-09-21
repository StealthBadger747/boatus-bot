const puppeteer = require('puppeteer')

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
                console.log('clicked answer: ', question);
                question.click();
                // return
            }
        }
    });
}

async function getAnswers(pageFrame, numOfQuestions) {
    console.log('GETTING ANSWERS!');
    await pageFrame.waitForSelector('#contentFrame', {visible: true, timeout: defaultTimeoutMS });

    for (x = 0; x < numOfQuestions; x++) {
        await clickCorrectAnswers(pageFrame);
        console.log('Selected answers');

        const submitButton = await pageFrame.waitForXPath('//button[text()="Submit"]', {visible: true, timeout: defaultTimeoutMS });
        await submitButton.click();
        console.log('Clicked submit');

        await delay(100);

        // The submit button turns into the "Next" Button
        await submitButton.click();
        console.log('Next Clicked');

        await delay(200);

        // If the screen counter goes invisible then it is safe to assume the quiz is done.
        const screenCounterIsVisible = await pageFrame.evaluate(() => {
            const element = document.querySelector('p[id="screenCount"]');
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
          
            return style.visibility !== 'hidden' && !!(rect.bottom || rect.top || rect.height || rect.width);
        });
        if (!screenCounterIsVisible) { break }
    }

    console.log('Finished quiz!');
}


function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }

puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
}).then(async browser => {
    if (!username || !password) {
        console.log("ERROR: username and/or password have not bee provided!")
        return
    }

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

    const launchCourse = await page.waitForXPath('//a[contains(string(),"Final Exam")]', {visible: true, timeout: defaultTimeoutMS });
    const finalExamHref = await (await launchCourse.getProperty('href')).jsonValue();
    console.log('finalExamHref', finalExamHref);
    await page.goto(finalExamHref);
    await page.waitForNavigation();

    const scormdriverContent = await page.waitForSelector('#scormdriver_content', {visible: false, timeout: 0 })
    const pageFrame = await scormdriverContent.contentFrame();

    const targetElement = await pageFrame.waitForXPath('//div[text()="Take Final Exam"]', {visible: true, timeout: 0 });
    await delay(3000);
    const takeFinalExam = await targetElement.getProperty('parentNode');
    await takeFinalExam.click();

    while (true) {
        await pageFrame.waitForSelector('#navbar_module_title', {visible: true, timeout: 0 });
        const regex = /Course End/i;
        const navbarTitle = await pageFrame.$eval('#navbar_module_title', e => e.textContent);
        let m;
        if ((m = regex.exec(navbarTitle)) !== null) {
            console.log('Course is done!');
            break;
        }
        else {
            await getAnswers(pageFrame, 50);
            console.log('Waiting for "Continue to <State> State Exam')
            await pageFrame.waitForXPath('//div[contains(string(),"Continue to")]', {visible: true, timeout: 15000 });

            await delay(1000);

            await pageFrame.evaluate(() => {
                var element = document.evaluate('//a[contains(string(),"Continue to")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                element.click();
            })
            console.log('State exam clicked!');
            
            await delay(2000);

            console.log('Waiting for "Take Test" to appear')
            await pageFrame.evaluate(() => {
                var element = document.evaluate('//a[contains(string(),"Take Test")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                element.click();
            })

            await getAnswers(pageFrame, 10);
            break;
        }
    }

});
