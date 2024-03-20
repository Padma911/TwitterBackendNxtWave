const express = require("express");
const app = express();
module.exports = app;

app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const path = require("path");
const sqlite3 = require("sqlite3");

const dbPath = path.join(__dirname, "twitterClone.db");

let db;
const initializedbandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (err) {
    console.log(`Db Error:'${err.message}'`);
    process.exit(1);
  }
};

initializedbandServer();

//register
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  console.log(hashedPassword);
  console.log(username);
  const query = `SELECT * FROM user WHERE username='${username}';`;

  const dbUser = await db.get(query);
  console.log(dbUser);

  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const q = `INSERT INTO user (username, name, password, gender)
        
        VALUES('${username}', '${name}', '${hashedPassword}', '${gender}');`;

      await db.run(q);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  console.log(username, password);

  const q = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(q);
  console.log(dbUser);

  if (dbUser === undefined) {
    response.status(400), response.send("Invalid user");
  } else {
    //  console.log(dbUser.password);
    const verifiedPassword = await bcrypt.compare(password, dbUser.password);
    //   console.log(verifiedPassword);
    if (verifiedPassword) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "o");
      console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticationToken = (request, response, next) => {
  const authHeads = request.headers["authorization"];
  let jwtToken;

  if (authHeads !== undefined) {
    jwtToken = authHeads.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "o", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        //  console.log("inauthentication");
        request.username = payload.username;
        // console.log(request.username);
        next();
      }
    });
  }
};
const combineObject = (username, tweets) => {
  let returnList = tweets.map((each) => ({
    username: username,
    tweet: each.tweet,
    dateTime: each.date_time,
  }));
  return returnList;
};

//user/tweets/feed
app.get("/user/tweets/feed", authenticationToken, async (request, response) => {
  const { username } = request;
  // console.log(username);

  const userOneQuery = `SELECT * FROM user WHERE username= '${username}'; `;
  const userResponse = await db.get(userOneQuery);
  const userOneId = userResponse.user_id;
  const userId = userResponse.user_id;
  // console.log(userId);

  const toGetUserTwoDetailsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${userOneId};`;
  const userTwoResponse = await db.all(toGetUserTwoDetailsQuery);

  //console.log(userTwoResponse);

  let allTweetsInformation = userTwoResponse.map(
    (each) => each.following_user_id
  );

  //console.log(allTweetsInformation);

  const query = `  SELECT user.username, tweet.tweet, tweet.date_time as dateTime
   FROM tweet NATURAL JOIN user WHERE tweet.user_id IN ( ${allTweetsInformation})
  ORDER BY dateTime DESC LIMIT 4  ;`;
  console.log(query);

  const dbResponse = await db.all(query);
  response.status(200);
  response.send(dbResponse);
});

//user/following/
app.get("/user/following/", authenticationToken, async (request, response) => {
  const { username } = request;
  console.log(username);

  const query = `
SELECT follower.following_user_id FROM follower INNER JOIN user ON follower.follower_user_id = user.user_id 
WHERE user.username = '${username}';
`;
  console.log(query);
  const queryResponse = await db.all(query);
  const followingUserIds = queryResponse.map((each) => each.following_user_id);

  const followingUserQuery = `
  SELECT name FROM user WHERE user_id IN (${followingUserIds})
  `;
  const followingUserResponse = await db.all(followingUserQuery);
  //console.log(followingUserResponse);

  response.status(200);
  response.send(followingUserResponse);
});

//user/followers/
app.get("/user/followers/", authenticationToken, async (request, response) => {
  const { username } = request;

  const userIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;

  const userIdResponse = await db.get(userIdQuery);
  const userId = userIdResponse.user_id;
  //console.log(userId);

  const followersQuery = `SELECT name FROM follower INNER JOIN user ON follower.follower_user_id = user.user_id WHERE follower.following_user_id =${userId}`;
  const followersResponse = await db.all(followersQuery);
  // console.log(followersResponse);
  response.status(200);
  response.send(followersResponse);
});

//tweets/:tweetId/
app.get("/tweets/:tweetId", authenticationToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;

  const userIdQuery = `SELECT user_id FROM user WHERE username ='${username}';`;
  const userResponse = await db.get(userIdQuery);
  const userId = userResponse.user_id;
  //console.log(userId);

  const tweetUserIdQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;
  const tweetUserResponse = await db.get(tweetUserIdQuery);
  const tweetUserId = tweetUserResponse.user_id;
  //console.log(tweetUserId);

  const followingUsersIdQuery = `SELECT follower.following_user_id from follower inner join user on user.user_id = 
follower.follower_user_id WHERE user.user_id = ${userId};
`;
  const followingUsersResponse = await db.all(followingUsersIdQuery);
  const followingUsersId = followingUsersResponse.map(
    (each) => each.following_user_id
  );
  // console.log(followingUsersId);

  let a = false;
  for (let each of followingUsersId) {
    if (each === tweetUserId) {
      a = true;
    }
  }

  //console.log(a);

  if (a) {
    const query = `
    SELECT tweet.tweet, count(reply_id) as replies, tweet.date_time as dateTime FROM (tweet NATURAL JOIN reply )  WHERE tweet_id=${tweetId}
    `;
    const queryResponse = await db.get(query);
    const likeQuery = `SELECT count(like_id) as likes FROM tweet  NATURAL JOIN like WHERE tweet_id=${tweetId}; `;
    const likeREsponse = await db.get(likeQuery);
    // console.log(queryResponse, likeREsponse);
    const result = {
      tweet: queryResponse.tweet,
      likes: likeREsponse.likes,
      replies: queryResponse.replies,
      dateTime: queryResponse.dateTime,
    };
    console.log(result);
    response.send(result);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

///tweets/:tweetId/likes/
app.get(
  "/tweets/:tweetId/likes/",
  authenticationToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    console.log(tweetId);

    const userIdQuery = `SELECT user_id FROM user WHERE username ='${username}';`;
    const userResponse = await db.get(userIdQuery);
    const userId = userResponse.user_id;
    console.log(userId);

    const tweetUserIdQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;
    const tweetUserResponse = await db.get(tweetUserIdQuery);
    console.log(tweetUserResponse);
    const tweetUserId = tweetUserResponse.user_id;
    //console.log(tweetUserId);

    const followingUsersIdQuery = `SELECT follower.following_user_id from follower inner join user on user.user_id = 
follower.follower_user_id WHERE user.user_id = ${userId};
`;
    const followingUsersResponse = await db.all(followingUsersIdQuery);
    const followingUsersId = followingUsersResponse.map(
      (each) => each.following_user_id
    );
    // console.log(followingUsersId);

    let a = false;
    for (let each of followingUsersId) {
      if (each === tweetUserId) {
        a = true;
      }
    }

    if (a) {
      const query = `SELECT * FROM like INNER JOIN user ON like.user_id = user.user_id WHERE like.tweet_id =${tweetId}`;
      const res = await db.all(query);
      // console.log(res);

      let names = res.map((each) => each.username);
      console.log(names);

      response.status(200);
      response.send({ likes: names });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

///tweets/:tweetId/replies/
app.get(
  "/tweets/:tweetId/replies/",
  authenticationToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    const userIdQuery = `SELECT user_id FROM user WHERE username ='${username}';`;
    const userResponse = await db.get(userIdQuery);
    const userId = userResponse.user_id;
    //console.log(userId);

    const tweetUserIdQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;
    const tweetUserResponse = await db.get(tweetUserIdQuery);
    const tweetUserId = tweetUserResponse.user_id;
    //console.log(tweetUserId);

    const followingUsersIdQuery = `SELECT follower.following_user_id from follower inner join user on user.user_id = 
follower.follower_user_id WHERE user.user_id = ${userId};
`;
    const followingUsersResponse = await db.all(followingUsersIdQuery);
    const followingUsersId = followingUsersResponse.map(
      (each) => each.following_user_id
    );
    // console.log(followingUsersId);

    let a = false;
    for (let each of followingUsersId) {
      if (each === tweetUserId) {
        a = true;
      }
    }
    if (a) {
      const query = `SELECT * FROM reply INNER JOIN user ON reply.user_id = user.user_id WHERE reply.tweet_id =${tweetId}`;
      const res = await db.all(query);
      // console.log(res);

      let names = res.map((each) => ({ name: each.name, reply: each.reply }));
      console.log(names);

      response.status(200);
      response.send({ replies: names });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

///user/tweets/
app.get("/user/tweets/", authenticationToken, async (request, response) => {
  const { username } = request;
  const userIdQuery = `SELECT user_id FROM user WHERE username ='${username}';`;
  const userIdResponse = await db.get(userIdQuery);
  const userId = userIdResponse.user_id;
  // console.log(userId);

  const allTweetsQuery = `SELECT * from tweet where user_id =${userId};`;
  const allTweetsResponse = await db.all(allTweetsQuery);
  // console.log(allTweetsResponse);

  const tweetIds = allTweetsResponse.map((id) => id.tweet_id);
  //console.log(tweetIds);

  const repliesQuery = `SELECT *, count(reply_id)as replies FROM reply WHERE tweet_id In (${tweetIds}) GROUP BY tweet_id ;`;
  const repliesResponse = await db.all(repliesQuery);
  //  console.log(repliesResponse);

  const likesQuery = `SELECT *, COUNT(like_id) as likes FROM like WHERE tweet_id IN (${tweetIds} ) GROUP BY tweet_id ;`;
  const likesResponse = await db.all(likesQuery);

  // console.log(likesResponse);

  const findingLikes = (id, listOfLikes) => {
    let likes;
    for (let likeObject of listOfLikes) {
      if (id === likeObject.tweet_id) {
        likes = likeObject.likes;
      }
    }
    return likes;
  };

  const findingReplies = (id, listOfReplies) => {
    let likes;
    for (let likeObject of listOfReplies) {
      if (id === likeObject.tweet_id) {
        likes = likeObject.replies;
      }
    }
    return likes;
  };

  const findingDateTime = (id, listOfLikes) => {
    let likes;
    for (let likeObject of listOfLikes) {
      if (id === likeObject.tweet_id) {
        likes = likeObject.date_time;
      }
    }
    return likes;
  };
  const findingTweet = (id, listOfLikes) => {
    let likes;
    for (let likeObject of listOfLikes) {
      if (id === likeObject.tweet_id) {
        likes = likeObject.tweet;
      }
    }
    return likes;
  };

  const resultList = [];
  for (let id of tweetIds) {
    likes = findingLikes(id, likesResponse);
    //  console.log(likes, id);
    replies = findingReplies(id, repliesResponse);

    dateTime = findingDateTime(id, allTweetsResponse);

    tweet = findingTweet(id, allTweetsResponse);

    resultList.push({
      tweet_id: tweet,
      likes: likes,
      replies: replies,
      dateTime: dateTime,
    });
    console.log(resultList);
  }

  response.status(200);
  response.send(resultList);
});

///user/tweets/
app.post("/user/tweets/", authenticationToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;
  console.log(tweet);
  const userIdQuery = `SELECT user_id FROM user WHERE username ='${username}';`;
  const userIdResponse = await db.get(userIdQuery);
  const userId = userIdResponse.user_id;

  const date = new Date();
  const datetime = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
  const query = `INSERT INTO tweet (tweet, user_id, date_time) 
VALUES ('${tweet}', ${userId}, '${datetime}');
`;
  console.log(query);
  await db.run(query);
  response.status(200);
  response.send("Created a Tweet");
});

///tweets/:tweetId/
app.delete(
  "/tweets/:tweetId/",
  authenticationToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const userIdQuery = `SELECT user_id FROM user WHERE username ='${username}';`;
    const userIdResponse = await db.get(userIdQuery);
    const userId = userIdResponse.user_id;

    const tweetsQuery = `SELECT * FROM tweet WHERE user_id=${userId};`;
    const tweetsResponse = await db.all(tweetsQuery);
    // console.log(tweetsResponse);

    const tweetIds = tweetsResponse.map((each) => each.tweet_id);
    console.log(tweetIds);
    let a = false;
    for (let id of tweetIds) {
      console.log(id, tweetId);
      if (id == tweetId) {
        a = true;
      }
    }
    console.log(a);

    if (a) {
      const query = `DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
      await db.run(query);
      response.status(200);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
