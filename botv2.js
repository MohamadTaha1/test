    const { Client: WhatsAppClient, LocalAuth, MessageMedia } = require('whatsapp-web.js');
    const { Client: DiscordClient } = require('discord.js-selfbot-v13');
    const qrcode = require('qrcode-terminal');
    const fs = require('fs');
    const path = require('path');
    const usersFilePath = path.join(__dirname, 'users.json');

    const whatsappClient = new WhatsAppClient({
        authStrategy: new LocalAuth()
    });
    const discordClient = new DiscordClient({ checkUpdate: false });

    let requestQueue = [];
    let userStates = {};
    // WhatsApp Client Setup
    whatsappClient.on('qr', qr => {
        qrcode.generate(qr, { small: true });
    });

    whatsappClient.on('ready', () => {
        console.log('WhatsApp client is ready!');
    });

    

    whatsappClient.on('message', async message => {
        try {
            const senderNumber = message.from.toString().includes('@c.us') ? message.from.split('@')[0] : message.from;
            let userData = getUserData(senderNumber);
            if (senderNumber === '96171442418' || senderNumber === '96171683519'|| senderNumber === '9613217319' || senderNumber === '96181611436') {
            
                if (message.body.startsWith('!adduser')) {
                    const userDetails = message.body.slice(9);
                    const response = addUser(userDetails);
                
                    if (response.error) {
                        await message.reply(response.error);
                        return;
                    }
                
                    await message.reply("User added successfully.");
        
                    // Send confirmation message to the added user with referral code
                    const confirmationMessage = `🎊🎉 Congrats! 🎉🎊\n\n Your subscription was confirmed and will end on ${response.newUser.endDate}. Your referral code is ${response.newUser.referral}. \n\n In order to start, here are some instructions on how to use our services:

                    1️⃣ Open www.chegg.com 
                    2️⃣ Search for your question inside chegg
                    3️⃣ Click the question that you want the answer to
                    4️⃣ Copy URL after you enter to the question
                    5️⃣ Paste in this chat
                    6️⃣ Wait 2-5 minutes and you’ll receive the answer
                    
                    For any kind of support and assistance in any problem that might arise while using Chegg.lb, please do not hesitate to contact our technical support member: 81611436`;
                    

                    try {
                        await whatsappClient.sendMessage(`${response.newUser.phonenumber}@c.us`, confirmationMessage);
                    } catch (error) {
                        console.error('Error sending confirmation message:', error);
                }
                
                } else if (message.body === '!showusers') {
                    const usersData = getUsersData();
                    await message.reply(`Users: \n${JSON.stringify(usersData, null, 2)}`);
                }
                else if (message.body.startsWith('!alteruser')) {
                    const response = alterUser(message.body.slice(11));
                    await message.reply(response);
                }
            } 

            if (userStates[senderNumber]) {
                await handleSubscriptionProcess(message, senderNumber);
                return; // Important to return here to avoid processing the message further
            }
            
            if (message.body.startsWith('https://www.chegg.com/homework-help/questions-and-answers/')) {
                // Extracting the Chegg link from the message
                const cheggLink = message.body;
        
                // Prepare the link with the command prefix
                const commandPrefixedLink = `$egg ${cheggLink}`;
        
                // Check if user is subscribed and subscription is valid
                if (userData && isSubscriptionValid(userData.endDate)) {
                    console.log(`Authorized request from ${senderNumber}:`, userData);
                    
                    // Push the command-prefixed Chegg link to the requestQueue
                    requestQueue.push(commandPrefixedLink); // Now pushing with $egg command
                    console.log('Pushed to requestQueue:', commandPrefixedLink);
        
                    await message.reply("Fetching solution... might take a couple of minutes.");
                    console.log('Reply sent on WhatsApp');
                    sendToDiscord(commandPrefixedLink); // Assuming sendToDiscord is defined elsewhere and handles the Discord notification
                } else {
                    // User is not subscribed or subscription is invalid
                    console.log(`${senderNumber} is not subscribed or subscription is invalid.`);
                    await handleSubscriptionProcess(message, senderNumber); // Assuming this function is defined elsewhere
                }
            }
            if (message.body.startsWith('start') || message.body.startsWith('Start')){
                console.log(`${senderNumber} is not subscribed or subscription is invalid.`);
                    await handleSubscriptionProcess(message, senderNumber);
            }

            if (message.body === '!showbalance') {
                if (userData) {
                    await message.reply(`Your balance is: ${userData.balance}$`);
                } else {
                    await message.reply("You are not registered.");
                }
            }
            if (message.body === '!showreferred') {
                if (userData) {
                    const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
                    // Use the current user's referral code to find who they referred
                    const referredUsers = getReferredUsers(userData.referral, users);
                    const referredList = referredUsers.map(user => user.phonenumber).join('\n');
                    const replyMessage = referredList ? `Users referred by you:\n${referredList}` : "You haven't referred any users.";
                    await message.reply(replyMessage);
                } else {
                    await message.reply("You are not registered.");
                }
            }
            
            
            
            
            // No response for other types of messages
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    async function handleSubscriptionProcess(message, senderNumber) {
        console.log(`Handling subscription process for ${senderNumber}, current stage: ${userStates[senderNumber]?.stage}`);

        if (!userStates[senderNumber]) {
            console.log(`Sending subscription prompt to ${senderNumber}`);
            await message.reply('Welcome to Chegg.lb! 👋 \nWe have officially launched our Chegg Whatsapp bot and are ready to serve you.\nIn order to subscribe to our service, please type “subscribe”')
                .catch(error => console.error('Error sending message:', error));
            userStates[senderNumber] = { stage: 'awaitingSubscriptionConfirmation' };
        } else {
            switch (userStates[senderNumber].stage) {
                case 'awaitingSubscriptionConfirmation':
                    if (message.body.toLowerCase() === 'subscribe') {
                        console.log(`User ${senderNumber} responded with subscribe`);
                        let subscriptionOptions = 'Great! You’re ready to subscribe!😊\n\nNow please choose from one of these bundles by typing the quoted message beside it:\n1 Month (5$): “m1”\n3 Months (12$): “m3”\n12 Months/Yearly (40$): “m12”';
                        await message.reply(subscriptionOptions)
                            .catch(error => console.error('Error sending message:', error));
                        userStates[senderNumber].stage = 'awaitingSubscriptionChoice';
                    }
                    break;
                case 'awaitingSubscriptionChoice':
                    if (['m1', 'm3', 'm12','M1', 'M3', 'M12'].includes(message.body)) {
                        userStates[senderNumber].selectedPlan = message.body;
                        await message.reply('Good choice! 😁\nDid anyone refer you to our services? If so, please type their 4-digit referral code. If not, simply type “no');
                        userStates[senderNumber].stage = 'awaitingReferralCode';
                    }
                    break;
                case 'awaitingReferralCode':
                    let referralCode = message.body;
                    if (referralCode.toLowerCase() !== 'no' && !/^\d{4}$/.test(referralCode)) {
                        await message.reply('Invalid referral code. Please enter a valid 4-digit code or send "no".');
                    } else {
                        let paymentInstructions = `Okay then! 👍

                        Start your subscription by paying using any of the methods below👇 :
                        
                        1️⃣ MTC Dollars: 81611436
                        2️⃣ Alfa Dollars 81205378
                        3️⃣ Whish Money: 81611436
                        4️⃣ Crypto (USDT) Binance Pay Id: 91072543
                        
                        As soon as you are done paying, please type “paid”`;
                        await message.reply(paymentInstructions);
                        userStates[senderNumber].referralCode = referralCode;
                        userStates[senderNumber].stage = 'awaitingPaymentConfirmation';

                        // Notify admin
                        let subscriptionDates = getSubscriptionDates(userStates[senderNumber].selectedPlan);
                        let referrerCode = userStates[senderNumber].referralCode;

                        // Check if the referral code is valid (4 digits) or set to 'no'
                        referrerCode = (referrerCode && /^\d{4}$/.test(referrerCode)) ? referrerCode : 'no';

                        let adminMessage = `!adduser phonenumber:${senderNumber}, subscriptionType:${userStates[senderNumber].selectedPlan}, startDate:${subscriptionDates.start}, endDate:${subscriptionDates.end}, referrer:${referrerCode}`;
                        whatsappClient.sendMessage('96171442418@c.us', adminMessage);
                        whatsappClient.sendMessage('96181611436@c.us', adminMessage);
                    }
                    break;
                case 'awaitingPaymentConfirmation':
                    if (message.body.toLowerCase() === 'paid') {
                        await message.reply('Perfect! 👌\nPlease wait until your payment has been approved. A message confirming your subscription will be sent shortly!');
                        // Handle the activation of the subscription
                        delete userStates[senderNumber];
                    }
                    break;
            }
        }
    }

    function sendPeriodicMessage() {
        const message = "Bot is still online";   
            whatsappClient.sendMessage('96171442418@c.us', message);
            whatsappClient.sendMessage('96181611436@c.us', message);
    }
    
    setInterval(sendPeriodicMessage, 3600000);
    
    function getReferredUsers(referralCode, users) {
        return Object.values(users).filter(user => user.referrer === referralCode);
    }
    
    
    function addUser(userDetails) {
        const details = userDetails.split(',');
        let newUser = {};
    
        details.forEach(detail => {
            const [key, value] = detail.split(':').map(s => s.trim());
            newUser[key] = isNaN(value) || key === 'phonenumber' ? value : parseInt(value, 10);
        });
    
        if (!newUser.phonenumber) {
            console.error('Error: Phonenumber is required.');
            return { error: 'Error: Phonenumber is required.' };
        }
    
        try {
            const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
    
            if (users[newUser.phonenumber]) {
                console.error('Error: User already exists.');
                return { error: 'User already exists.' };
            }
    
            newUser.balance = 0; // Set initial balance to 0
    
            let referralCode;
            do {
                referralCode = Math.floor(1000 + Math.random() * 9000).toString();
            } while (checkReferralCodeExists(referralCode, users));
    
            newUser.referral = referralCode;

            let subscriptionDates = getSubscriptionDates(newUser.subscriptionType);
            newUser.endDate = subscriptionDates.end;
    
            if (newUser.referrer) {
                newUser.referrer = newUser.referrer.toString();
                let referrerUser = Object.values(users).find(user => user.referral === newUser.referrer);
                if (referrerUser) {
                    const bonus = calculateBonus(newUser.subscriptionType);
                    referrerUser.balance += bonus;
                    users[referrerUser.phonenumber] = referrerUser; // Update the referrer user in the users object
                }
            }
    
            users[newUser.phonenumber] = newUser;
            fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 4));
            return {
                message: `User added successfully.`,
                newUser: newUser // Include the newUser object in the response
            };
        } catch (error) {
            console.error('Error in addUser function:', error);
            return { error: 'An error occurred while adding the user.' };
        }
    }
    
    
    
    function checkReferralCodeExists(code, users) {
        return Object.values(users).some(user => user.referral === code);
    }
    
    function calculateBonus(subscriptionType) {
        const bonusAmounts = { 'm1': 1, 'm3': 2.4, 'm12': 6, 'M1': 1, 'M3': 2.4, 'M12': 6 }; // Example values
        return bonusAmounts[subscriptionType] || 0;
    }
    

    function checkReferralCodeExists(code, users) {
        return Object.values(users).some(user => user.referral === code);
    }

    function getSubscriptionDates(subscriptionType) {
        const startDate = new Date();
        let endDate = new Date(startDate);

        switch (subscriptionType) {
            case 'm1' || "M1":
                endDate.setMonth(endDate.getMonth() + 1);
                break;
            case 'm3' || "M3":
                endDate.setMonth(endDate.getMonth() + 3);
                break;
            case 'm12' || "M12":
                endDate.setFullYear(endDate.getFullYear() + 1);
                break;
            default:
                // Default to one month if unknown type
                endDate.setMonth(endDate.getMonth() + 1);
        }

        return {
            start: startDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
            end: endDate.toISOString().split('T')[0]    // Format as YYYY-MM-DD
        };
    }



    function getUsersData() {
        try {
            const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
            return users;
        } catch (error) {
            console.error('Error reading users file:', error);
            return {};
        }
    }

    function alterUser(userDetails) {
        const detailsLines = userDetails.split('\n');
        let userUpdates = {};

        detailsLines.forEach(line => {
            const [key, value] = line.split(':').map(s => s.trim());
            if (key && value) {
                userUpdates[key] = isNaN(value) || key === 'phonenumber' ? value : parseInt(value, 10);
            }
        });

        if (!userUpdates.phonenumber) {
            return 'Error: Phonenumber is required.';
        }

        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));

        if (!users[userUpdates.phonenumber]) {
            return 'User does not exist.';
        }

        Object.assign(users[userUpdates.phonenumber], userUpdates);
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 4));
        return 'User details altered successfully.';
    }


    function getUserData(userNumber) {
        try {
            const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
            if (users[userNumber]) {
                console.log(`getUserData: User Number - ${userNumber}, User Data -`, users[userNumber]);
                return users[userNumber];
            } else {
                console.log(`getUserData: User Number - ${userNumber} not found.`);
                return null; // Return null if user is not found
            }
        } catch (error) {
            console.error('Error reading users file:', error);
            return null;
        }
    }

    function isSubscriptionValid(endDate) {
        const today = new Date();
        const subscriptionEnd = new Date(endDate);
        console.log(subscriptionEnd >= today);
        return subscriptionEnd >= today;
    }


    async function sendToDiscord(content) {
        try {
            const targetChannel = await discordClient.channels.fetch('1062673831896027167');
            await targetChannel.send(content);
            console.log(`Content sent to Discord channel: ${content}`);
        } catch (error) {
            console.error('Error sending content to Discord:', error);
        }
    }

    discordClient.on('messageCreate', async message => {
        if (message.channel.type === 'DM' && message.author.id === '1179068434089255024') {
            let linkUrl = extractLinkFromButton(message);
            if (linkUrl && requestQueue.length > 0) {
                // Pop the next WhatsApp message from the queue
                let whatsappMessage = requestQueue.shift();
                // Ensure that whatsappMessage is indeed a message object with a reply function
                if (whatsappMessage && typeof whatsappMessage.reply === 'function') {
                    whatsappMessage.reply(`Here's your answer: ${linkUrl}`).catch(console.error);
                } else {
                    console.error('The item retrieved from the queue is not a proper WhatsApp message:', whatsappMessage);
                }
            }
        }
    });

    function extractLinkFromButton(message) {
        const regex = /\[Answer\]\((http.*?)\)/;
        const match = message.content.match(regex);
        if (match && match[1]) {
            return match[1];
        } else {
            return null;
        }
    }

    // Discord Client Setup
    discordClient.on('ready', async () => {
        console.log(`${discordClient.user.username} is ready!`);
    });

    discordClient.on('rateLimit', (rateLimitInfo) => {
        console.log(`Rate limit hit: ${JSON.stringify(rateLimitInfo)}`);
    });

    // Initialize both clients

    (async () => {
        try {
            await whatsappClient.initialize();
            console.log('WhatsApp client initialized successfully.');
        } catch (error) {
            console.error('Error initializing WhatsApp client:', error);
        }
        
        try {
            await discordClient.login('OTM0MTQxNjk4Njk3NzM2MjUz.Gk09t7.dZwdSr8auPvazplP1wb03sVDOPSkFiaq4P-YVA');
            console.log('Discord client logged in successfully.');
        } catch (error) {
            console.error('Error logging in Discord client:', error);
        }
    })();
