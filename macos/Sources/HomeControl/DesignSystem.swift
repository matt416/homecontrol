import SwiftUI

// Shared layout for the Mac app. The tablet frame has its own presentation.
enum HomeDesign {
    static let pageInset: CGFloat = 24
    static let sectionGap: CGFloat = 20
    static let sectionInset: CGFloat = 16
    static let rowGap: CGFloat = 12
    static let cornerRadius: CGFloat = 12
    static let readingWidth: CGFloat = 720
    static let canvas = Color(nsColor: .windowBackgroundColor)
    static let surface = Color(nsColor: .controlBackgroundColor)
}

struct HomePage<Content: View, Actions: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder var content: Content
    @ViewBuilder var actions: Actions

    var body: some View {
        GeometryReader { geometry in
            pageBody.frame(width: geometry.size.width, height: geometry.size.height, alignment: .topLeading)
        }
        .background(HomeDesign.canvas)
        .controlSize(.regular)
    }

    private var pageBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(title).font(.system(size: 22, weight: .semibold))
                        .accessibilityAddTraits(.isHeader)
                    Text(subtitle).font(.callout).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                actions.fixedSize()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, HomeDesign.pageInset)
            .padding(.vertical, 18)
            Divider()
            content.frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

struct HomeContent<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HomeDesign.sectionGap) { content }
                .frame(maxWidth: HomeDesign.readingWidth, alignment: .leading)
                .padding(HomeDesign.pageInset)
                .frame(maxWidth: .infinity, alignment: .center)
        }
    }
}

struct HomeSection<Content: View>: View {
    private let title: String?
    private let content: Content

    init(_ title: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: HomeDesign.rowGap) {
            if let title {
                Text(title).font(.headline).accessibilityAddTraits(.isHeader)
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(HomeDesign.sectionInset)
        .background(HomeDesign.surface, in: RoundedRectangle(cornerRadius: HomeDesign.cornerRadius))
        .overlay {
            RoundedRectangle(cornerRadius: HomeDesign.cornerRadius)
                .strokeBorder(.primary.opacity(0.08), lineWidth: 1)
        }
    }
}

struct HomeFilterBar<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: HomeDesign.rowGap) { content }
                .padding(.horizontal, HomeDesign.pageInset)
                .padding(.vertical, HomeDesign.sectionInset)
            Divider()
        }
    }
}

struct HomeFooter<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(spacing: 0) {
            Divider()
            HStack(spacing: HomeDesign.rowGap) { content }
                .padding(.horizontal, HomeDesign.pageInset)
                .padding(.vertical, HomeDesign.sectionInset)
        }
        .background(HomeDesign.canvas)
    }
}

struct HomeSettingRow<Control: View>: View {
    let title: String
    @ViewBuilder var control: Control
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: HomeDesign.rowGap) {
            Text(title).frame(width: 180, alignment: .leading)
            control.frame(maxWidth: .infinity, alignment: .trailing)
        }
    }
}

enum HomeNoticeKind {
    case information, success, warning, error
    var icon: String {
        switch self {
        case .information: "info"
        case .success: "circle-check"
        case .warning: "triangle-alert"
        case .error: "circle-alert"
        }
    }
    var color: Color {
        switch self {
        case .information: .secondary
        case .success: .green
        case .warning: .orange
        case .error: .red
        }
    }
}

struct HomeNotice: View {
    let text: String
    var kind: HomeNoticeKind = .information
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            HomeIcon( kind.icon).foregroundStyle(kind.color)
            Text(text).fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
        }
        .font(.callout)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(HomeDesign.rowGap)
        .background(kind.color.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
        .accessibilityElement(children: .combine)
    }
}

struct HomeEmptyState<Actions: View>: View {
    let title: String
    let systemImage: String
    var description: String = ""
    @ViewBuilder var actions: Actions

    var body: some View {
        ContentUnavailableView {
            HomeLabel(title, icon: systemImage)
        } description: {
            if !description.isEmpty { Text(description) }
        } actions: {
            actions
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

extension HomeEmptyState where Actions == EmptyView {
    init(_ title: String, systemImage: String, description: String = "") {
        self.title = title
        self.systemImage = systemImage
        self.description = description
        self.actions = EmptyView()
    }
}
