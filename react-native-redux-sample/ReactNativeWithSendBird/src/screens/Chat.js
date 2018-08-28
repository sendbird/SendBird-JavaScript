import React, { Component } from "react";
import {
  Platform,
  View,
  FlatList,
  Text,
  KeyboardAvoidingView,
  CameraRoll,
  Alert,
  AsyncStorage,
  BackHandler,
  ScrollView,
  Image,
  TouchableOpacity
} from "react-native";
import { NavigationActions } from "react-navigation";
import Permissions from 'react-native-permissions';
import { connect } from "react-redux";
import Sound, { AudioRecorder, AudioUtils } from 'react-native-audio';
import {
  openChannelProgress,
  groupChannelProgress,
  initChatScreen,
  getChannelTitle,
  createChatHandler,
  onSendButtonPress,
  getPrevMessageList,
  onUserBlockPress,
  onFileButtonPress,
  typingStart,
  typingEnd,
  channelExit
} from "../actions";
import { Button, Spinner, TextItem, AudioItem, FileItem, ImageItem, MessageInput, Message, AdminMessage } from "../components";
import { BarIndicator } from "react-native-indicators";
import ImagePicker from "react-native-image-picker";
import { sbGetGroupChannel, sbGetOpenChannel, sbCreatePreviousMessageListQuery, sbAdjustMessageList, sbIsImageMessage, sbIsAudioMessage, sbMarkAsRead } from "../sendbirdActions";

class Chat extends Component {
  static navigationOptions = ({ navigation }) => {
    const { params } = navigation.state;
    const _renderInviteButton = () => {
      return params.isOpenChannel ? null : (
        <Button
          containerViewStyle={{ marginLeft: 0, marginRight: 0 }}
          buttonStyle={{ paddingLeft: 0, paddingRight: 0 }}
          iconRight={{ name: "user-plus", type: "font-awesome", color: "#7d62d9", size: 18 }}
          backgroundColor="transparent"
          onPress={() => {
            navigation.navigate("GroupChannelInvite", {
              title: "Invite",
              channelUrl: params.channelUrl
            });
          }}
        />
      );
    };
    return {
      title: `${params.title}(${params.memberCount})`,
      headerLeft: (
        <Button
          containerViewStyle={{ marginLeft: 0, marginRight: 0 }}
          buttonStyle={{ paddingLeft: 14 }}
          icon={{ name: "chevron-left", type: "font-awesome", color: "#7d62d9", size: 18 }}
          backgroundColor="transparent"
          onPress={() => {
            params.handleHeaderLeft();
          }}
        />
      ),
      headerRight: (
        <View style={{ flexDirection: "row" }}>
          {_renderInviteButton()}
          <Button
            containerViewStyle={{ marginLeft: 0, marginRight: 0 }}
            buttonStyle={{ paddingLeft: 4, paddingRight: 4 }}
            iconRight={{ name: "users", type: "font-awesome", color: "#7d62d9", size: 18 }}
            backgroundColor="transparent"
            onPress={() => {
              navigation.navigate("Member", { isOpenChannel: params.isOpenChannel, channelUrl: params.channelUrl });
            }}
          />
          <Button
            containerViewStyle={{ marginLeft: 0, marginRight: 0 }}
            buttonStyle={{ paddingLeft: 0, paddingRight: 14 }}
            iconRight={{ name: "user-times", type: "font-awesome", color: "#7d62d9", size: 18 }}
            backgroundColor="transparent"
            onPress={() => {
              navigation.navigate("BlockUser");
            }}
          />
        </View>
      )
    };
  };

  constructor(props) {
    super(props);
    this.flatList = null;
    this.state = {
      channel: null,
      isLoading: false,
      previousMessageListQuery: null,
      textMessage: "",
      isImageListOpened: false,
      photos: [],

      // audio
      isRecording: false,
      audioPath: AudioUtils.DocumentDirectoryPath + '/audio.aac',
    };
  }

  componentDidMount() {
    this.props.initChatScreen();
    this.props.navigation.setParams({ handleHeaderLeft: this._onBackButtonPress });
    const { channelUrl, isOpenChannel, isFromPayload } = this.props.navigation.state.params;
    if (isOpenChannel) {
      sbGetOpenChannel(channelUrl).then(channel => this.setState({ channel }, () => this._componentInit()));
    } else {
      sbGetGroupChannel(channelUrl).then(channel => this.setState({ channel }, () => this._componentInit()));
    }

    BackHandler.addEventListener('hardwareBackPress', this._onBackButtonPress);
    if (isFromPayload) {
      AsyncStorage.removeItem("payload", () => {});
    }
    // obtain the gallery photos
    this._obtainGalleryPhotos();
  }

  componentWillUnmount() {
    BackHandler.removeEventListener('hardwareBackPress', this._onBackButtonPress);
  }

  _componentInit = () => {
    const { channelUrl, isOpenChannel } = this.props.navigation.state.params;
    this.props.openChannelProgress(false);
    this.props.groupChannelProgress(false);
    this.props.getChannelTitle(channelUrl, isOpenChannel);
    this.props.createChatHandler(channelUrl, isOpenChannel);
    this._getMessageList(true);
    if (!isOpenChannel) {
      sbMarkAsRead({ channelUrl });
    }
  };

  componentDidUpdate() {
    const { channelUrl, isOpenChannel } = this.props.navigation.state.params;
    if (!isOpenChannel) {
      this.state.textMessage ? this.props.typingStart(channelUrl) : this.props.typingEnd(channelUrl);
    }
  }

  /**
   * Obtain the gallery photo items
   */
  _obtainGalleryPhotos = async () => {
    const params = { first: 5 };
    
    const photos = await CameraRoll.getPhotos(params);
    this.setState({ photos: photos.edges });
  }

  _onBackButtonPress = () => {
    const { channelUrl, isOpenChannel, _initListState } = this.props.navigation.state.params;
    if (_initListState) _initListState();
    this.setState({ isLoading: true }, () => {
      this.props.channelExit(channelUrl, isOpenChannel);
    });
    return true;
  };

  componentWillReceiveProps(props) {
    const { title, memberCount, list, exit } = props;
    const { channelUrl, isOpenChannel } = this.props.navigation.state.params;

    if (memberCount !== this.props.memberCount || title !== this.props.title) {
      const setParamsAction = NavigationActions.setParams({
        params: { memberCount, title },
        key: this.props.navigation.state.key
      });
      this.props.navigation.dispatch(setParamsAction);
    }

    if (list !== this.props.list) {
      this.setState({ isLoading: false });
    }

    if (exit) {
      this.setState({ isLoading: false }, () => {
        this.props.navigation.goBack();
      });
    }
  }

  _onTextMessageChanged = textMessage => {
    this.setState({ textMessage });
  };

  _onUserBlockPress = userId => {
    Alert.alert("User Block", "Are you sure want to block user?", [{ text: "Cancel" }, { text: "OK", onPress: () => this.props.onUserBlockPress(userId) }]);
  };

  _getMessageList = init => {
    if (!this.state.previousMessageListQuery && !init) {
      return;
    }
    const { channelUrl, isOpenChannel } = this.props.navigation.state.params;
    this.setState({ isLoading: true }, () => {
      if (init) {
        sbCreatePreviousMessageListQuery(channelUrl, isOpenChannel)
          .then(previousMessageListQuery => {
            this.setState({ previousMessageListQuery }, () => {
              this.props.getPrevMessageList(this.state.previousMessageListQuery);
            });
          })
          .catch(error => this.props.navigation.goBack());
      } else {
        this.props.getPrevMessageList(this.state.previousMessageListQuery);
      }
    });
  };

  _onSendButtonPress = () => {
    if (this.state.textMessage) {
      const { channelUrl, isOpenChannel } = this.props.navigation.state.params;
      const { textMessage } = this.state;
      this.setState({ textMessage: "" }, () => {
        this.props.onSendButtonPress(channelUrl, isOpenChannel, textMessage);
        if(this.props && this.props.list && this.props.list.length > 0) {
          this.flatList.scrollToIndex({
            index: 0,
            viewOffset: 0
          });
        }
      });
    }
  };

  _onPhotoAddPress = () => {
    const { channelUrl, isOpenChannel } = this.props.navigation.state.params;
    Permissions.checkMultiple([ 'photo' ]).then(response => {
      if(response.photo === 'authorized') {
        ImagePicker.showImagePicker(
          {
            title: "Select Image File To Send",
            mediaType: "photo",
            noData: true
          },
          response => {
            if (!response.didCancel && !response.error && !response.customButton) {
              let source = { uri: response.uri };
              if (response.name) {
                source["name"] = response.fileName;
              } else {
                paths = response.uri.split("/");
                source["name"] = paths[paths.length - 1];
              }
              if (response.type) {
                source["type"] = response.type;
              } else {
                /** For react-native-image-picker library doesn't return type in iOS,
                 *  it is necessary to force the type to be an image/jpeg (or whatever you're intended to be).
                */
                if (Platform.OS === "ios") {
                  source["type"] = 'image/jpeg';
                }
              }
              this.props.onFileButtonPress(channelUrl, isOpenChannel, source);
            }
          }
        );
      } else if(response.photo === 'undetermined') {
        Permissions.request('photo').then(response => {
          this._onPhotoAddPress();
        });
      } else {
        Alert.alert('Permission denied',
          'You declined the permission to access to your photo.',
          [ { text: 'OK' } ],
          { cancelable: false });
      }
    });
  };

  _prepareRecordingPath = (audioPath) => {
    AudioRecorder.prepareRecordingAtPath(audioPath, {
      SampleRate: 22050,
      Channels: 1,
      AudioQuality: "Low",
      AudioEncoding: "aac",
      AudioEncodingBitRate: 32000
    });
  }

  _onAudioIconPress = () => {    
    Permissions.checkMultiple([ 'microphone' ]).then(response => {
      if (response.microphone === 'authorized') {
        this.setState({ hasPermission: true }, this._record);
      } else if(response.microphone === 'undetermined') {
        Permissions.request('microphone').then(response => {
          this.setState({ hasPermission: true }, this._record);
        });
      } else {
        Alert.alert('Permission denied',
          'You declined the permission to access to record the audio.',
          [ { text: 'OK' } ],
          { cancelable: false });
      }
    })
    .catch(err => alert(err));
  }

  _record = () => {
    const { isRecording, audioPath, hasPermission } = this.state;

    if (!hasPermission) {
      alert('Can\'t record, no permission granted!');
      return;
    }

    if (isRecording) {
      this._stop();
      return;
    }

    this._prepareRecordingPath(audioPath);
    this.setState({ isRecording: true }, () => {
      setTimeout(async () => {
        try {
          const filePath = await AudioRecorder.startRecording();
        } catch (error) {
          alert(error);
        }
      }, 200);
    });
  }

  _stop = () => {
    this.setState({ isRecording: false }, async () => {
      try {
        const filePath = await AudioRecorder.stopRecording();
        this._uploadAudio('file://'.concat(filePath));
      } catch (error) {
        alert(error);
      }
    });
  }

  _uploadAudio = (uri) => {
    const { onFileButtonPress, navigation } = this.props;
    const { channelUrl, isOpenChannel } = navigation.state.params;

    const source = {
      uri: uri,
      type: 'audio/aac',
      name: 'audio.aac'
    };
    onFileButtonPress(channelUrl, isOpenChannel, source);
  }

  _renderFileMessageItem = rowData => {
    const message = rowData.item;
    if (message.isUserMessage()) {
      return <TextItem isUser={message.isUser} message={message.message} />;
    } else if (sbIsImageMessage(message)) {
      return <ImageItem isUser={message.isUser} message={message.url.replace("http://", "https://")} />;
    } else if (sbIsAudioMessage(message)) {
      return <AudioItem message={message.url} />;
    } else {
      return <FileItem isUser={message.isUser} message={message.name} />;
    }
  };

  _renderList = rowData => {
    const message = rowData.item;
    const { isOpenChannel } = this.props.navigation.state.params;
    const { channel } = this.state;
    if (message.isUserMessage() || message.isFileMessage()) {
      return (
        <Message
          key={message.messageId ? message.messageId : message.reqId}
          isShow={message.sender.isShow}
          isUser={message.isUser}
          profileUrl={message.sender.profileUrl.replace("http://", "https://")}
          onPress={() => this._onUserBlockPress(message.sender.userId)}
          nickname={message.sender.nickname}
          time={message.time}
          readCount={isOpenChannel || !channel ? 0 : channel.getReadReceipt(message)}
          message={this._renderFileMessageItem(rowData)}
        />
      );
    } else if (message.isAdminMessage()) {
      return <AdminMessage message={message.message} />;
    } else {
      return <View />;
    }
  };

  _renderTyping = () => {
    const { isOpenChannel } = this.props.navigation.state.params;
    return isOpenChannel ? null : (
      <View style={styles.renderTypingViewStyle}>
        <View style={{ opacity: this.props.typing ? 1 : 0, marginRight: 8 }}>
          <BarIndicator count={4} size={10} animationDuration={900} color="#cbd0da" />
        </View>
        <Text style={{ color: "#cbd0da", fontSize: 10 }}>{this.props.typing}</Text>
      </View>
    );
  };

  /**
   * Callback when Image Item pressed
   * send the image to the sendbird
   */
  _onImageItemPress = (photo) => () => {
    const { onFileButtonPress, navigation } = this.props;
    const { channelUrl, isOpenChannel } = navigation.state.params;

    const source = {
      uri: photo.node.image.uri,
      type: photo.node.type,
      name: photo.node.group_name
    };
    onFileButtonPress(channelUrl, isOpenChannel, source);
  }

  /**
   * Render the image item component individually
   */
  _renderImageItem = (photo, index) => (
    <TouchableOpacity onPress={this._onImageItemPress(photo)}>
      <Image
        key={index}
        style={styles.imageStyle}
        source={{ uri: photo.node.image.uri }}
        resizeMode={'cover'}
      />
    </TouchableOpacity>
  )

  /**
   * Render the image contents
   */
  _renderImageList = () => {
    const { photos, isImageListOpened } = this.state;
    const isAnyPhotoExist = photos.length > 0;

    if (isAnyPhotoExist && isImageListOpened) {
      return (
        <ScrollView style={styles.imageListStyle} horizontal>
          {photos.map(this._renderImageItem)}
        </ScrollView>
      );
    }
    return null;
  }

  /**
   * Callback when the image icon is pressed
   * Toggle show/hidden the image list picker below the chat input box
   */
  _onImageIconPress = () => {
    this.setState((prevState) => ({
      isImageListOpened: !prevState.isImageListOpened
    }));
  }

  render() {
    const { list: chatItems } = this.props;
    const { isLoading, photos } = this.state;

    return (
      <KeyboardAvoidingView style={styles.containerViewStyle} enabled>
        <Spinner visible={isLoading} />
        <FlatList
          style={styles.messageListViewStyle}
          contentContainerStyle={styles.messageListContentStyle}
          ref={elem => this.flatList = elem}
          renderItem={this._renderList}
          data={chatItems}
          extraData={this.state}
          keyExtractor={(item, index) => item.messageId + ''}
          onEndReached={() => this._getMessageList(false)}
          onEndReachedThreshold={0}
        />
        <View style={styles.messageInputViewStyle}>
          {this._renderTyping()}
          <MessageInput
            isRecording={this.state.isRecording}
            onLeftPress={this._onPhotoAddPress}
            onAudioIconPress={this._onAudioIconPress}
            onImageIconPress={this._onImageIconPress}
            onRightPress={this._onSendButtonPress}
            textMessage={this.state.textMessage}
            onChangeText={this._onTextMessageChanged}
            onSubmitEditing={this._onSendButtonPress}
          />
          {this._renderImageList()}
        </View>
      </KeyboardAvoidingView>
    );
  }
}

function mapStateToProps({ chat }) {
  let { title, memberCount, list, exit, typing } = chat;
  list = sbAdjustMessageList(list);
  return { title, memberCount, list, exit, typing };
}

export default connect(mapStateToProps, {
  openChannelProgress,
  groupChannelProgress,
  initChatScreen,
  getChannelTitle,
  createChatHandler,
  onSendButtonPress,
  getPrevMessageList,
  onUserBlockPress,
  onFileButtonPress,
  typingStart,
  typingEnd,
  channelExit
})(Chat);

const styles = {
  renderTypingViewStyle: {
    flexDirection: "row",
    marginLeft: 14,
    marginRight: 14,
    marginTop: 4,
    marginBottom: 0,
    paddingBottom: 0,
    height: 14
  },
  containerViewStyle: {
    backgroundColor: '#f1f2f6',
    flex: 1
  },
  imageListStyle: {
    height: 100
  },
  imageStyle: {
    width: 100,
    height: 100,
  },
  messageListViewStyle: {
    flex: 1,
    transform: [{ scaleY: -1 }]
  },
  messageListContentStyle: {
    paddingVertical: 24
  },
  messageInputViewStyle: {
    marginBottom: 0,
    flexDirection: "column",
    justifyContent: "center"
  }
};
