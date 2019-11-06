# Messenger Media Downloader
A utility for downloading photos/videos/audios from facebook messenger chats.<br/>
The utility caches your session, so you will be prompted to log in only on the first launch or when to fail to log in with the cached session.<br/>
Downloading and media scanning save progress, so you are safe to restart the utility. Keep in mind that new messages that you receive after
conversation scanning started will be ignored. To scan&download such messages, you will have to reinstall the utility.

## Command line options
#### -r, --reset - Resets the saved session, allows to relog to Facebook.
#### -a, --all - Download photos/videos/audios from all conversations.
#### -l, --list - List all conversations and their threadIds.
#### -t, --thread &lt;threadId&gt; - Download photos/videos/audios from the conversation with given threadID.
#### -i, --infinite - Keep retrying until all operations succeed.
#### -h, --help - Print help.
#### -V, --version - Print version.

<a name="infinite_explanation"></a>There seem to be some kind of API calls limit so if you attempt to dump media from a large conversation
or all conversations, you will most likely hit the limit. That's why there's is -i, --infinite option, so the utility will keep retrying
to dump everything until it succeeds.


## Usage
[Node.js](https://nodejs.org/) is required to run the utility.<br/>
Command line options are pretty self-explanatory.<br/>
Run with -a, -all option to dump media from all conversations.<br/>
To dump media from a single conversation you have to get its threadId. In order to do that run the utility with -l, --list option,
read threadId of the conversation you are interested in, and then run the utility with -t --thread &lt;threadId&gt; option.<br/>
I recommend to run the above along with -i, --infinite, see [here](#infinite_explanation) for the explanation.

## Output
Downloaded files are outputted to ```./outputs/<conversation_name || threadID>/```.

# License
The utility is licensed under [MIT License](./LICENSE).
