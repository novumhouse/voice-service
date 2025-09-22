/// Flutter Client Example for Voice Service API
/// Dart implementation for Flutter apps

import 'dart:convert';
import 'package:http/http.dart' as http;

class VoiceAgent {
  final String id;
  final String agentId;
  final String name;
  final String description;
  final String language;
  final String specialization;
  final bool isActive;

  VoiceAgent({
    required this.id,
    required this.agentId,
    required this.name,
    required this.description,
    required this.language,
    required this.specialization,
    required this.isActive,
  });

  factory VoiceAgent.fromJson(Map<String, dynamic> json) {
    return VoiceAgent(
      id: json['id'],
      agentId: json['agentId'],
      name: json['name'],
      description: json['description'],
      language: json['language'],
      specialization: json['specialization'],
      isActive: json['isActive'],
    );
  }
}

class VoiceSession {
  final String id;
  final String userId;
  final String agentId;
  final String status;
  final String startTime;
  final String clientType;
  final int duration;

  VoiceSession({
    required this.id,
    required this.userId,
    required this.agentId,
    required this.status,
    required this.startTime,
    required this.clientType,
    required this.duration,
  });

  factory VoiceSession.fromJson(Map<String, dynamic> json) {
    return VoiceSession(
      id: json['id'],
      userId: json['userId'],
      agentId: json['agentId'],
      status: json['status'],
      startTime: json['startTime'],
      clientType: json['clientType'],
      duration: json['duration'] ?? 0,
    );
  }
}

class VoiceUsage {
  final int totalDuration;
  final int sessionCount;
  final int limit;
  final int remainingTime;
  final bool isLimitReached;
  final String date;

  VoiceUsage({
    required this.totalDuration,
    required this.sessionCount,
    required this.limit,
    required this.remainingTime,
    required this.isLimitReached,
    required this.date,
  });

  factory VoiceUsage.fromJson(Map<String, dynamic> json) {
    return VoiceUsage(
      totalDuration: json['totalDuration'],
      sessionCount: json['sessionCount'],
      limit: json['limit'],
      remainingTime: json['remainingTime'],
      isLimitReached: json['isLimitReached'],
      date: json['date'],
    );
  }
}

class VoiceServiceClient {
  final String baseUrl;
  final String userToken;
  final http.Client _client;

  VoiceServiceClient({
    required this.baseUrl,
    required this.userToken,
    http.Client? client,
  }) : _client = client ?? http.Client();

  /// Get headers for API requests
  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'X-API-TOKEN': userToken,
  };

  /// Make API request with error handling
  Future<Map<String, dynamic>> _makeRequest(
    String endpoint, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final url = Uri.parse('$baseUrl$endpoint');
    
    late http.Response response;
    
    switch (method.toUpperCase()) {
      case 'GET':
        response = await _client.get(url, headers: _headers);
        break;
      case 'POST':
        response = await _client.post(
          url,
          headers: _headers,
          body: body != null ? json.encode(body) : null,
        );
        break;
      default:
        throw ArgumentError('Unsupported HTTP method: $method');
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json.decode(response.body) as Map<String, dynamic>;
    } else {
      final errorData = json.decode(response.body) as Map<String, dynamic>?;
      throw Exception(errorData?['error'] ?? 'HTTP ${response.statusCode}');
    }
  }

  /// Get list of available voice agents
  Future<List<VoiceAgent>> getAgents() async {
    final response = await _makeRequest('/api/voice/agents');
    final agentsData = response['data']['agents'] as List;
    return agentsData.map((agent) => VoiceAgent.fromJson(agent)).toList();
  }

  /// Get specific agent information
  Future<VoiceAgent> getAgent(String agentId) async {
    final response = await _makeRequest('/api/voice/agents/$agentId');
    return VoiceAgent.fromJson(response['data']['agent']);
  }

  /// Start voice conversation
  Future<Map<String, dynamic>> startConversation({
    required String agentId,
    required String conversationId,
    Map<String, dynamic>? metadata,
  }) async {
    final response = await _makeRequest(
      '/api/voice/conversations/start',
      method: 'POST',
      body: {
        'agentId': agentId,
        'conversationId': conversationId,
        'clientType': 'flutter',
        'metadata': {
          ...metadata ?? {},
          'platform': 'flutter',
        },
      },
    );

    return {
      'sessionId': response['data']['sessionId'],
      'conversationData': response['data']['conversationData'],
      'session': VoiceSession.fromJson(response['data']['session']),
    };
  }

  /// End voice conversation
  Future<VoiceSession> endConversation(String sessionId) async {
    final response = await _makeRequest(
      '/api/voice/conversations/$sessionId/end',
      method: 'POST',
    );
    return VoiceSession.fromJson(response['data']['session']);
  }

  /// Get conversation status
  Future<VoiceSession> getConversationStatus(String sessionId) async {
    final response = await _makeRequest('/api/voice/conversations/$sessionId/status');
    return VoiceSession.fromJson(response['data']['session']);
  }

  /// Get user's voice usage statistics
  Future<VoiceUsage> getVoiceUsage() async {
    final response = await _makeRequest('/api/voice/sessions/usage');
    return VoiceUsage.fromJson(response['data']['usage']);
  }

  /// Get active sessions
  Future<List<VoiceSession>> getActiveSessions() async {
    final response = await _makeRequest('/api/voice/sessions/active');
    final sessionsData = response['data']['sessions'] as List;
    return sessionsData.map((session) => VoiceSession.fromJson(session)).toList();
  }

  /// Health check
  Future<Map<String, dynamic>> healthCheck() async {
    final response = await _makeRequest('/api/voice/health');
    return response['data'];
  }

  /// Dispose of resources
  void dispose() {
    _client.close();
  }
}

/// Flutter Widget Example
class VoiceConversationWidget extends StatefulWidget {
  final String userToken;
  final String baseUrl;

  const VoiceConversationWidget({
    Key? key,
    required this.userToken,
    required this.baseUrl,
  }) : super(key: key);

  @override
  _VoiceConversationWidgetState createState() => _VoiceConversationWidgetState();
}

class _VoiceConversationWidgetState extends State<VoiceConversationWidget> {
  late VoiceServiceClient _client;
  List<VoiceAgent> _agents = [];
  VoiceUsage? _usage;
  String? _currentSessionId;
  bool _isLoading = false;
  String _status = 'Disconnected';

  @override
  void initState() {
    super.initState();
    _client = VoiceServiceClient(
      baseUrl: widget.baseUrl,
      userToken: widget.userToken,
    );
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    
    try {
      final agents = await _client.getAgents();
      final usage = await _client.getVoiceUsage();
      
      setState(() {
        _agents = agents;
        _usage = usage;
      });
    } catch (e) {
      _showError('Failed to load data: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _startConversation(String agentId) async {
    if (_usage?.isLimitReached == true) {
      _showError('Daily voice limit reached');
      return;
    }

    setState(() => _isLoading = true);
    
    try {
      final result = await _client.startConversation(
        agentId: agentId,
        conversationId: 'flutter_${DateTime.now().millisecondsSinceEpoch}',
      );
      
      setState(() {
        _currentSessionId = result['sessionId'];
        _status = 'Connected';
      });
      
      // Here you would integrate with ElevenLabs WebRTC
      // using the conversationData from the result
      _showSuccess('Conversation started');
      
    } catch (e) {
      _showError('Failed to start conversation: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _endConversation() async {
    if (_currentSessionId == null) return;
    
    setState(() => _isLoading = true);
    
    try {
      await _client.endConversation(_currentSessionId!);
      
      setState(() {
        _currentSessionId = null;
        _status = 'Disconnected';
      });
      
      _showSuccess('Conversation ended');
      await _loadInitialData(); // Refresh usage
      
    } catch (e) {
      _showError('Failed to end conversation: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.green),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Voice Conversation'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Status
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        children: [
                          Icon(
                            _currentSessionId != null 
                                ? Icons.mic 
                                : Icons.mic_off,
                            color: _currentSessionId != null 
                                ? Colors.green 
                                : Colors.red,
                          ),
                          const SizedBox(width: 8),
                          Text('Status: $_status'),
                        ],
                      ),
                    ),
                  ),
                  
                  // Usage Info
                  if (_usage != null) ...[
                    const SizedBox(height: 16),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Daily Usage: ${_usage!.totalDuration}s / ${_usage!.limit}s'),
                            const SizedBox(height: 8),
                            LinearProgressIndicator(
                              value: _usage!.totalDuration / _usage!.limit,
                              backgroundColor: Colors.grey[300],
                              valueColor: AlwaysStoppedAnimation<Color>(
                                _usage!.isLimitReached ? Colors.red : Colors.blue,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text('Remaining: ${_usage!.remainingTime}s'),
                          ],
                        ),
                      ),
                    ),
                  ],
                  
                  // Agents List
                  const SizedBox(height: 16),
                  const Text('Available Agents:', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Expanded(
                    child: ListView.builder(
                      itemCount: _agents.length,
                      itemBuilder: (context, index) {
                        final agent = _agents[index];
                        return Card(
                          child: ListTile(
                            title: Text(agent.name),
                            subtitle: Text(agent.description),
                            trailing: _currentSessionId != null
                                ? ElevatedButton(
                                    onPressed: _endConversation,
                                    style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                                    child: const Text('End'),
                                  )
                                : ElevatedButton(
                                    onPressed: () => _startConversation(agent.id),
                                    child: const Text('Start'),
                                  ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  @override
  void dispose() {
    _client.dispose();
    super.dispose();
  }
}

/// Usage Example
void main() {
  runApp(MaterialApp(
    home: VoiceConversationWidget(
      userToken: '1711|JPcIqtiocWWw0XUDu94YsyaoVw3n6ZST50n9rxtJ90e4e4f6',
      baseUrl: 'http://localhost:3001',
    ),
  ));
}
